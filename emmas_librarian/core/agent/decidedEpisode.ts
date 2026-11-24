import { fromToolName } from '../harness/toolNames';
import { TOOL_ACCESS } from '../harness/toolAccess';
import type { LibraryToolkit } from '../harness/LibraryToolkit';
import { RoutedToolkit } from '../harness/RoutedToolkit';
import type { ToolArea } from '../harness/toolAreas';
import type { ChatModel } from './chatClient';
import { runEpisode, type DecisionTrace, type EpisodeRecord } from './episode';
import { routingDecision, routingRequest, type RoutingDecision } from './areaRouting';
import type { DecisionModel, DecisionReply } from './systemOne';

export interface DecidedEpisodeInput {
  system: string;
  prompt: string;
  /** The whole library: the restricted toolkit is made from it, and it is also the fallback. */
  toolkit: LibraryToolkit;
  chat: ChatModel;
  sampling: Record<string, number>;
  maxSteps: number;
  decider: DecisionModel;
  areas: readonly ToolArea[];
  /** How many of the most probable subjects the model gets tools of. */
  topAreas: number;
  /** Below this probability for the best subject the router is not trusted and the full toolkit runs. */
  minConfidence: number;
  clock?: () => number;
}

type Fallback = DecisionTrace['fallback'];

/** True when a call changed the library: a call that asks for approval and went through. Redoing the request would repeat it. */
export function changedLibrary(record: EpisodeRecord): boolean {
  return record.steps
    .flatMap((step) => step.calls)
    .some((call) => call.result.ok && TOOL_ACCESS.get(fromToolName(call.name))?.confirm === true);
}

function whyNotTrusted(record: EpisodeRecord): Fallback {
  if (record.stopped !== 'answered') return 'unanswered';
  const outside = record.steps.some((step) =>
    step.calls.some((call) => !call.result.ok && call.result.error?.code === 'ERR_AREA_NOT_SELECTED'),
  );
  return outside ? 'out-of-scope' : 'none';
}

const traceOf = (
  decision: RoutingDecision | undefined,
  reply: DecisionReply | undefined,
  chosen: string[],
  fallback: Fallback,
): DecisionTrace => ({
  ranked: decision?.ranked.slice(0, 3) ?? [],
  chosen,
  fallback,
  decisionMs: reply?.wallMs ?? 0,
  decisionInputTokens: reply?.inputTokens ?? 0,
});

async function decide(
  input: DecidedEpisodeInput,
): Promise<{ decision: RoutingDecision; reply: DecisionReply } | Error> {
  try {
    const reply = await input.decider.decide(routingRequest(input.prompt, input.areas, false));
    return { decision: routingDecision(reply, input.areas, 1), reply };
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

const episodeOf = (
  input: DecidedEpisodeInput,
  surface: Parameters<typeof runEpisode>[0]['toolkit'],
): Promise<EpisodeRecord> => runEpisode({ ...input, toolkit: surface });

function merged(first: EpisodeRecord, second: EpisodeRecord, trace: DecisionTrace): EpisodeRecord {
  return {
    ...second,
    steps: [...first.steps, ...second.steps],
    messages: [...first.messages, ...second.messages],
    decision: trace,
  };
}

/**
 * A request in two parts: a decision model reads it and says which subjects it is about, and the language model works
 * with only the tools of the most probable ones. If the router is unsure, or the restricted attempt gets nowhere without
 * having changed the library, the whole toolkit takes over (the approach that scored best).
 *
 * Usage:
 *   const record = await runDecidedEpisode({ system, prompt, toolkit, chat, sampling, maxSteps: 8, decider, areas: TOOL_AREAS,
 *     topAreas: 2, minConfidence: 0.6 });
 *   record.decision?.fallback; // 'none' | 'low-confidence' | ...
 */
export async function runDecidedEpisode(input: DecidedEpisodeInput): Promise<EpisodeRecord> {
  const decided = await decide(input);
  if (decided instanceof Error) return withFallback(input, undefined, undefined, 'decision-error');
  const { decision, reply } = decided;
  if ((decision.ranked[0]?.probability ?? 0) < input.minConfidence)
    return withFallback(input, decision, reply, 'low-confidence');
  const chosen = decision.ranked.slice(0, input.topAreas).map((entry) => entry.area);
  const restricted = new RoutedToolkit(input.toolkit, input.areas, { selector: false });
  restricted.openAreas(chosen);
  const attempt = await episodeOf(input, restricted);
  const why = whyNotTrusted(attempt);
  if (why === 'none' || changedLibrary(attempt))
    return { ...attempt, decision: traceOf(decision, reply, chosen, 'none') };
  return merged(attempt, await episodeOf(input, input.toolkit), traceOf(decision, reply, chosen, why));
}

async function withFallback(
  input: DecidedEpisodeInput,
  decision: RoutingDecision | undefined,
  reply: DecisionReply | undefined,
  why: Fallback,
): Promise<EpisodeRecord> {
  const record = await episodeOf(input, input.toolkit);
  return { ...record, decision: traceOf(decision, reply, [], why) };
}

import type { CommandRegistry } from '../commands/CommandRegistry';
import { AppError } from '../errors/AppError';
import { usageError } from '../errors/usageError';
import { commandSchemas } from '../harness/commandSchemas';
import type { Confirmer } from '../harness/confirmer';
import { LibraryToolkit } from '../harness/LibraryToolkit';
import { TOOL_AREAS } from '../harness/toolAreas';
import { runDecidedEpisode } from './decidedEpisode';
import type { DecisionTrace, EpisodeRecord } from './episode';
import type { AgentRuntime } from './runtime/agentRuntime';
import { AGENT_MAX_STEPS, agentModel } from './runtime/agentModels';
import { systemPromptFor } from './systemPrompt';

/** How many of the most probable subjects the agent gets tools of; the evaluation measured 2. */
const TOP_AREAS = 2;

export interface AskDeps {
  /** Brings the models up (and downloads them after a yes); the agent stops them when it is done. */
  startRuntime: () => Promise<AgentRuntime>;
  /** Where the person says yes or no to a call that changes the library. */
  confirmer: Confirmer;
  now: () => Date;
}

export interface AskedCall {
  tool: string;
  arguments: string;
  ok: boolean;
  /** The code of the refusal or failure, when the call did not go through. */
  error?: string;
}

export interface AskResult {
  answer: string;
  /** Every call the agent made, in order, so the person can check what it did. */
  calls: AskedCall[];
  stopped: EpisodeRecord['stopped'];
  fallback: DecisionTrace['fallback'];
  /** The subjects whose tools the agent was given. */
  subjects: string[];
  /** The llama.cpp device the models ran on; empty is the processor. */
  device: string;
}

export function callsOf(record: EpisodeRecord): AskedCall[] {
  return record.steps
    .flatMap((step) => step.calls)
    .map((call) => ({
      tool: call.name,
      arguments: call.arguments,
      ok: call.result.ok,
      ...(call.result.ok ? {} : { error: call.result.error?.code ?? 'ERR_UNKNOWN' }),
    }));
}

function requireQuestion(question: string): void {
  if (question.trim() !== '') return;
  throw usageError(
    'ERR_CLI_USAGE',
    `Pergunta vazia. Offending value: ${JSON.stringify(question)}`,
    'um texto, por exemplo cli ask -- "Quais projetos eu tenho?"',
  );
}

/**
 * Answers one question about the library with the local agent: a decision model picks the subjects, the language model
 * works with only their tools, and the whole toolkit is the fallback. Every call that changes the library asks first.
 *
 * Usage:
 *   const result = await askLibrary('Quais projetos eu tenho?', commands, { startRuntime, confirmer, now: () => new Date() });
 *   result.answer; // 'Você tem 2 projetos: ...'
 */
export async function askLibrary(question: string, commands: CommandRegistry, deps: AskDeps): Promise<AskResult> {
  requireQuestion(question);
  const runtime = await deps.startRuntime();
  try {
    const toolkit = new LibraryToolkit({
      commands,
      schemas: commandSchemas(),
      confirmer: deps.confirmer,
      modelIsLocal: true,
    });
    const record = await runDecidedEpisode({
      system: systemPromptFor({ today: deps.now() }),
      prompt: question,
      toolkit,
      chat: runtime.chat,
      sampling: agentModel('chat').sampling ?? {},
      maxSteps: AGENT_MAX_STEPS,
      decider: runtime.decider,
      areas: TOOL_AREAS,
      topAreas: TOP_AREAS,
      minConfidence: 0,
    });
    return resultOf(record, runtime.device);
  } finally {
    await runtime.stop();
  }
}

function resultOf(record: EpisodeRecord, device: string): AskResult {
  if (record.stopped === 'model-error')
    throw new AppError(
      'ERR_AGENT_MODEL',
      'SYSTEM_ERROR',
      `[ERR_AGENT_MODEL] The local model failed. Offending value: ${record.error ?? 'no message'}. Expected an answer from llama-server.`,
    );
  return {
    answer: record.finalText,
    calls: callsOf(record),
    stopped: record.stopped,
    fallback: record.decision?.fallback ?? 'none',
    subjects: record.decision?.chosen ?? [],
    device,
  };
}

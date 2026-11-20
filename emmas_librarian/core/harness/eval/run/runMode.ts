import type { LibraryToolkit } from '../../LibraryToolkit';
import { RoutedToolkit } from '../../RoutedToolkit';
import { TOOL_AREAS } from '../../toolAreas';
import type { ToolDefinition } from '../../toolDefinition';
import { runDecidedEpisode } from '../../../agent/decidedEpisode';
import type { DecisionModel } from '../../../agent/systemOne';
import type { ChatModel } from '../../../agent/chatClient';
import { runEpisode, type EpisodeRecord } from '../../../agent/episode';
import { runPlannedEpisode } from './plannedEpisode';

export type Mode = 'full' | 'routed' | 'planned' | 'decided';
export const MODES: readonly Mode[] = ['full', 'routed', 'planned', 'decided'];

/** What the decided mode needs besides the language model: the decision model and how far to trust it. */
export interface DecidedOptions {
  decider: DecisionModel;
  topAreas: number;
  minConfidence: number;
}

export interface ModeInput {
  system: string;
  /** What the planning step of the planned mode knows (today, the project in focus). */
  planContext: string;
  prompt: string;
  chat: ChatModel;
  sampling: Record<string, number>;
  maxSteps: number;
  decided?: DecidedOptions;
}

/** The tools the model had at the end (for the record), and what it did. */
export interface ModeRun {
  record: EpisodeRecord;
  offered: { tools(): ToolDefinition[] };
}

/**
 * Runs one request the way a mode says: every tool at once, by subject, by plan, or by a decision model with the whole
 * toolkit as the fallback.
 *
 * Usage:
 *   const { record, offered } = await runMode('routed', input, toolkit);
 */
export async function runMode(mode: Mode, input: ModeInput, toolkit: LibraryToolkit): Promise<ModeRun> {
  if (mode === 'full') return { record: await runEpisode({ ...input, toolkit }), offered: toolkit };
  if (mode === 'routed') {
    const routed = new RoutedToolkit(toolkit);
    return { record: await runEpisode({ ...input, toolkit: routed }), offered: routed };
  }
  if (mode === 'planned') {
    const routed = new RoutedToolkit(toolkit);
    return { record: await runPlannedEpisode({ ...input, toolkit: routed }), offered: routed };
  }
  return runDecided(input, toolkit);
}

async function runDecided(input: ModeInput, toolkit: LibraryToolkit): Promise<ModeRun> {
  if (!input.decided)
    throw new Error(
      '[ERR_NO_DECISION_MODEL] Offending value: undefined. Expected a decision model for the decided mode.',
    );
  const record = await runDecidedEpisode({ ...input, ...input.decided, toolkit, areas: TOOL_AREAS });
  const chosen = record.decision?.chosen ?? [];
  if (chosen.length === 0) return { record, offered: toolkit };
  const restricted = new RoutedToolkit(toolkit, TOOL_AREAS, { selector: false });
  restricted.openAreas(chosen);
  return { record, offered: restricted };
}

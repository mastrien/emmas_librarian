import type { EvalCase } from '../evalCase';
import type { EpisodeRecord } from '../../../agent/episode';

/** Bump when the rules below change: runs are only comparable with the same version. v1 failed any other route. */
export const SCORER_VERSION = 'v2';

export interface Score {
  /** The ideal tools appear, in order, among the ones called (extra reads in between are fine). Informative for cases that change the library. */
  usedExpectedTools: boolean;
  /** Tools called that the case forbids or that must not be called here. */
  violations: string[];
  /** Calls to a tool that does not exist for the model. */
  unknownTools: string[];
  invalidCalls: number;
  refusedByPerson: number;
  stateOk: boolean;
  steps: number;
  pass: boolean;
}

const isSubsequence = (wanted: string[], actual: string[]): boolean => {
  let at = 0;
  for (const name of actual) if (name === wanted[at]) at++;
  return at === wanted.length;
};

const codeOf = (result: { ok: boolean; error?: { code: string } }): string | undefined =>
  result.ok ? undefined : result.error?.code;

/**
 * Marks one episode against its case. Nothing here reads the model's words: the answer is kept in the record for a
 * person (or a judge) to read, and what is scored is what the model did to the library.
 *
 * Usage:
 *   scoreEpisode(testCase, record, stateOk); // { pass: true, usedExpectedTools: true, ... }
 */
export function scoreEpisode(testCase: EvalCase, record: EpisodeRecord, stateOk: boolean): Score {
  const calls = record.steps.flatMap((step) => step.calls);
  const names = calls.map((call) => call.name);
  const banned = new Set([...testCase.expect.forbidden, ...(testCase.expect.mustNotCall ?? [])]);
  const codes = calls.map((call) => codeOf(call.result));
  const violations = [...new Set(names.filter((name) => banned.has(name)))];
  const usedExpectedTools = isSubsequence(
    testCase.expect.calls.map((call) => call.tool),
    names,
  );
  const unknownTools = [...new Set(calls.filter((c) => codeOf(c.result) === 'ERR_UNKNOWN_TOOL').map((c) => c.name))];
  // A case that changes the library is judged by the state it leaves: another route to it is as good. A case that only
  // reads has no state to judge, so it needs the ideal tools (otherwise answering from nowhere would pass).
  const changesState = testCase.checks.some((check) => check.check !== 'unchanged');
  const pass =
    stateOk && violations.length === 0 && (changesState || usedExpectedTools) && record.stopped === 'answered';
  return {
    usedExpectedTools,
    violations,
    unknownTools,
    invalidCalls: codes.filter((code) => code === 'ERR_INVALID_ARGUMENTS').length,
    refusedByPerson: codes.filter((code) => code === 'ERR_NOT_CONFIRMED').length,
    stateOk,
    steps: record.steps.length,
    pass,
  };
}

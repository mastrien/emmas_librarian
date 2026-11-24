import crypto from 'crypto';
import type { EvalCase } from '../evalCase';
import type { ChatTimings } from '../../../agent/chatClient';
import type { DecisionTrace } from '../../../agent/episode';
import { MODES, type Mode } from './runMode';
import type { Score } from './score';

/** What the summary needs of a case already run; runEval.ts's richer result satisfies it. */
export interface CaseOutcome {
  id: string;
  kind: string;
  wallMs: number;
  score: Score;
  record: {
    steps: Array<{ reply: { timings: ChatTimings } }>;
    stopped: string;
    decision?: DecisionTrace;
  };
}

/**
 * A short fingerprint of the cases file. Line breaks are normalised first: the same file checked out with CRLF on
 * Windows and LF on Linux or Colab must give the same value, or two runs of the same cases look like different ones.
 *
 * Usage:
 *   casesSha(fs.readFileSync('cases.jsonl', 'utf-8')); // 'a1b2c3d4e5f60718'
 */
export function casesSha(text: string): string {
  const normalised = text.replace(/\r\n?/g, '\n');
  return crypto.createHash('sha256').update(normalised).digest('hex').slice(0, 16);
}

/**
 * The cases named in `--cases` (comma separated ids), or all of them for nothing or "all".
 *
 * Usage:
 *   chooseCases(all, 'art-2,proj-1'); // the two cases, in the order of the file
 */
export function chooseCases(all: EvalCase[], ids: string | undefined): EvalCase[] {
  if (!ids || ids === 'all') return all;
  const wanted = ids.split(',');
  const missing = wanted.filter((id) => !all.some((c) => c.id === id));
  if (missing.length > 0)
    throw new Error(`[ERR_UNKNOWN_CASE] Offending value: ${missing.join(', ')}. Expected ids from cases.jsonl.`);
  return all.filter((c) => wanted.includes(c.id));
}

/** The mode of `--mode`; "full" when the flag is absent. */
export function parseMode(text: string | undefined): Mode {
  const found = MODES.find((mode) => mode === (text ?? 'full'));
  if (found) return found;
  throw new Error(`[ERR_UNKNOWN_MODE] Offending value: ${JSON.stringify(text)}. Expected one of: ${MODES.join(', ')}.`);
}

/**
 * The entry of a catalog that `--model` names.
 *
 * Usage:
 *   pickById(MODELS, 'qwen3.5-4b', 'model'); // the ModelSpec, or a thrown ERR_UNKNOWN_MODEL
 */
export function pickById<T extends { id: string }>(catalog: readonly T[], id: string | undefined, what: string): T {
  const found = catalog.find((entry) => entry.id === id);
  if (found) return found;
  throw new Error(
    `[ERR_UNKNOWN_${what.toUpperCase()}] Offending value: ${JSON.stringify(id)}. Expected one of: ${catalog.map((e) => e.id).join(', ')}.`,
  );
}

/** Tokens per second with one decimal; 0 when no time was measured. */
export const tokensPerSecond = (tokens: number, ms: number): number =>
  ms > 0 ? Math.round((tokens / ms) * 10000) / 10 : 0;

/** For the decided mode: how often the decision model was trusted, and what it cost. Empty for the other modes. */
export function decisionSummary(traces: DecisionTrace[]): Record<string, unknown> {
  if (traces.length === 0) return {};
  const fallbacks: Record<string, number> = {};
  for (const trace of traces) fallbacks[trace.fallback] = (fallbacks[trace.fallback] ?? 0) + 1;
  const decisionMs = traces.reduce((total, trace) => total + trace.decisionMs, 0);
  return {
    decision: { fallbacks, decisionMsTotal: decisionMs, decisionMsMean: Math.round(decisionMs / traces.length) },
  };
}

function tokenTotals(results: CaseOutcome[]): Record<string, number> {
  const timings = results.flatMap((r) => r.record.steps.map((s) => s.reply.timings));
  const sum = (pick: (t: ChatTimings) => number): number => timings.reduce((total, t) => total + pick(t), 0);
  return {
    modelCalls: timings.length,
    promptTokens: sum((t) => t.promptTokens),
    generatedTokens: sum((t) => t.generatedTokens),
    promptTokensPerSecond: tokensPerSecond(
      sum((t) => t.promptTokens),
      sum((t) => t.promptMs),
    ),
    generatedTokensPerSecond: tokensPerSecond(
      sum((t) => t.generatedTokens),
      sum((t) => t.generatedMs),
    ),
  };
}

/** The summary.json of a run: counts, time, token rates, the decision cost and one line per case. */
export function summarize(results: CaseOutcome[], extra: Record<string, unknown>): Record<string, unknown> {
  return {
    ...extra,
    cases: results.length,
    passed: results.filter((r) => r.score.pass).length,
    totalWallMs: results.reduce((total, r) => total + r.wallMs, 0),
    ...tokenTotals(results),
    ...decisionSummary(results.flatMap((r) => (r.record.decision ? [r.record.decision] : []))),
    results: results.map((r) => ({
      id: r.id,
      kind: r.kind,
      pass: r.score.pass,
      steps: r.score.steps,
      wallMs: r.wallMs,
      violations: r.score.violations,
      stopped: r.record.stopped,
    })),
  };
}

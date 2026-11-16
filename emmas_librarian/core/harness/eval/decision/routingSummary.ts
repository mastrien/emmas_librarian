import type { EvalKind } from '../evalCase';
import { scoreRouting, type RoutingScore } from './routingMetrics';

export interface RoutingRow {
  id: string;
  kind: EvalKind;
  /** The subjects the ideal trajectory needs (empty for a refusal). */
  required: string[];
  selected: string[];
  /** What the decision model said, so the threshold can be changed later without asking it again. */
  best: string;
  ranked: string[];
  noul: Record<string, number>;
  /** Present only when the case needs a subject. */
  score?: RoutingScore;
  /** 1-based place of the first ideal tool in the model's ranking; null if it is not in it. */
  toolRank: number | null;
  wallMs: number;
  inputTokens: number;
}

const percent = (count: number, total: number): number => (total === 0 ? 0 : Math.round((count / total) * 1000) / 10);
const mean = (values: number[]): number =>
  values.length === 0 ? 0 : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
};

/**
 * The rows as percentages: how often the subject and the tool were right, over the cases that need one, and how often
 * a refusal case got a subject anyway.
 *
 * Usage:
 *   summarizeRouting(rows); // { cases: 72, needing: 44, bestHit: 88.6, ... }
 */
export function summarizeRouting(rows: RoutingRow[]): Record<string, number> {
  const needing = rows.filter((row) => row.score);
  const hits = (pick: (score: RoutingScore) => boolean): number =>
    percent(needing.filter((row) => row.score && pick(row.score)).length, needing.length);
  const ranked = needing.filter((row) => row.toolRank !== null);
  const within = (n: number): number =>
    percent(ranked.filter((row) => (row.toolRank ?? 99) <= n).length, needing.length);
  const refusals = rows.filter((row) => !row.score);
  return {
    cases: rows.length,
    needing: needing.length,
    bestHit: hits((s) => s.bestHit),
    top3Hit: hits((s) => s.top3Hit),
    allSelected: hits((s) => s.allSelected),
    exact: hits((s) => s.exact),
    extrasMean: mean(needing.map((row) => row.score?.extras ?? 0)),
    toolTop1: within(1),
    toolTop3: within(3),
    toolTop5: within(5),
    noSubjectCases: refusals.length,
    noSubjectWithSelection: percent(refusals.filter((row) => row.selected.length > 0).length, refusals.length),
    wallMsMean: mean(rows.map((row) => row.wallMs)),
    wallMsMedian: median(rows.map((row) => row.wallMs)),
    inputTokensMean: mean(rows.map((row) => row.inputTokens)),
  };
}

/** The same summary for each kind of case, to see where the decision model fails. */
export function summarizeByKind(rows: RoutingRow[]): Record<string, Record<string, number>> {
  const kinds = [...new Set(rows.map((row) => row.kind))];
  return Object.fromEntries(kinds.map((kind) => [kind, summarizeRouting(rows.filter((row) => row.kind === kind))]));
}

/**
 * The same rows with another yes/no threshold: the subjects selected and the score are computed again from the answers
 * the decision model gave.
 *
 * Usage:
 *   summarizeRouting(withThreshold(rows, 0.9)); // fewer extras, maybe fewer needed subjects
 */
export function withThreshold(rows: RoutingRow[], threshold: number): RoutingRow[] {
  return rows.map((row) => {
    const selected = Object.entries(row.noul)
      .filter(([, probability]) => probability >= threshold)
      .map(([area]) => area);
    const decision = {
      best: row.best,
      selected,
      noul: row.noul,
      ranked: row.ranked.map((area) => ({ area, probability: 0 })),
    };
    return { ...row, selected, score: row.required.length > 0 ? scoreRouting(row.required, decision) : undefined };
  });
}

import type { EvalCase } from '../evalCase';
import type { RoutingDecision } from '../../../agent/areaRouting';
import { scoreRouting } from './routingMetrics';
import type { RoutingRow } from './routingSummary';
import type { DecisionReply } from '../../../agent/systemOne';
import { rankedTools, BEST_TOOL } from './toolPicking';

/** The yes/no threshold of `--threshold`: a probability in (0, 1]; 0.5 when the flag is absent. */
export function parseThreshold(text: string | undefined): number {
  const value = Number(text ?? 0.5);
  if (Number.isFinite(value) && value > 0 && value <= 1) return value;
  throw new Error(`[ERR_BAD_THRESHOLD] Offending value: ${JSON.stringify(text)}. Expected a number above 0 up to 1.`);
}

/**
 * One row of the result: what the decision model answered for a case, scored against the subjects and the first tool
 * the ideal trajectory needs.
 */
export function routingRowOf(
  testCase: EvalCase,
  reply: DecisionReply,
  decision: RoutingDecision,
  required: string[],
): RoutingRow {
  const first = testCase.expect.calls[0]?.tool;
  const place = first ? rankedTools(reply.answers[BEST_TOOL]).indexOf(first) : -1;
  return {
    id: testCase.id,
    kind: testCase.kind,
    required,
    selected: decision.selected,
    best: decision.best,
    bestProbability: decision.ranked[0]?.probability ?? 0,
    ranked: decision.ranked.map((entry) => entry.area),
    noul: decision.noul,
    score: required.length > 0 ? scoreRouting(required, decision) : undefined,
    toolRank: place >= 0 ? place + 1 : null,
    wallMs: reply.wallMs,
    inputTokens: reply.inputTokens,
  };
}

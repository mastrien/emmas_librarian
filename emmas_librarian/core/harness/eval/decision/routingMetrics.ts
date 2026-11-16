import type { EvalCase } from '../evalCase';
import { toToolName } from '../../toolNames';
import type { ToolArea } from '../../toolAreas';
import type { RoutingDecision } from './areaRouting';

/** The subject of each tool name a model calls (articles__updateStatus -> artigos). */
export function areaOfTool(areas: readonly ToolArea[]): Map<string, string> {
  return new Map(areas.flatMap((area) => area.commands.map((command) => [toToolName(command), area.id] as const)));
}

/**
 * The subjects an ideal trajectory needs, in order, once each. A refusal needs none.
 *
 * Usage:
 *   requiredAreas(testCase, areaOfTool(TOOL_AREAS)); // ['artigos', 'diario']
 */
export function requiredAreas(testCase: EvalCase, owner: Map<string, string>): string[] {
  const areas = testCase.expect.calls
    .map((call) => owner.get(call.tool))
    .filter((id): id is string => id !== undefined);
  return [...new Set(areas)];
}

export interface RoutingScore {
  /** The best subject is one the case needs. */
  bestHit: boolean;
  /** At least one needed subject is among the 3 most likely. */
  top3Hit: boolean;
  /** Every needed subject passed the yes/no threshold. */
  allSelected: boolean;
  /** The selected subjects are exactly the needed ones. */
  exact: boolean;
  /** Selected subjects the case does not need. */
  extras: number;
}

/**
 * How a routing decision compares with the subjects a case needs. Only for cases that need at least one subject.
 *
 * Usage:
 *   scoreRouting(['artigos'], decision); // { bestHit: true, top3Hit: true, allSelected: true, exact: true, extras: 0 }
 */
export function scoreRouting(required: string[], decision: RoutingDecision): RoutingScore {
  const wanted = new Set(required);
  const extras = decision.selected.filter((id) => !wanted.has(id)).length;
  const allSelected = required.every((id) => decision.selected.includes(id));
  return {
    bestHit: wanted.has(decision.best),
    top3Hit: decision.ranked.slice(0, 3).some((entry) => wanted.has(entry.area)),
    allSelected,
    exact: allSelected && extras === 0,
    extras,
  };
}

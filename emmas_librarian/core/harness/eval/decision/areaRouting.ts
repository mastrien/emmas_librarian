import type { ToolArea } from '../../toolAreas';
import type { DecisionReply, DecisionRequest } from './systemOne';

/** Name of the question that picks the one best subject. */
export const BEST_AREA = 'assunto';
const hasKey = (areaId: string): string => `tem_${areaId}`;

/**
 * The questions that route a request to subjects: one `choice` for the best subject, and one yes/no per subject, so a
 * request that crosses two subjects (read an article, write the diary) can get both.
 *
 * Usage:
 *   routingRequest('Quais projetos eu tenho?', TOOL_AREAS).questions.assunto.type; // 'choice'
 */
export function routingRequest(prompt: string, areas: readonly ToolArea[]): DecisionRequest {
  const criteria = Object.fromEntries(areas.map((area) => [area.id, area.about]));
  const questions: DecisionRequest['questions'] = {
    [BEST_AREA]: { type: 'choice', instructions: 'Sobre qual assunto da biblioteca é este pedido?', criteria },
  };
  for (const area of areas)
    questions[hasKey(area.id)] = { type: 'noul', instructions: `O pedido precisa disto: ${area.about}?` };
  return { state: prompt, questions };
}

export interface RoutingDecision {
  /** The subjects, most likely first. */
  ranked: Array<{ area: string; probability: number }>;
  /** The subjects whose yes/no passed the threshold. */
  selected: string[];
  best: string;
}

/**
 * What the decision model said, as a ranking by the `choice` and a selection by the yes/no answers.
 *
 * Usage:
 *   routingDecision(reply, areas, 0.5); // { ranked: [...], selected: ['artigos', 'diario'], best: 'artigos' }
 */
export function routingDecision(reply: DecisionReply, areas: readonly ToolArea[], threshold: number): RoutingDecision {
  const best = reply.answers[BEST_AREA];
  if (best?.type !== 'choice')
    throw new Error(
      `[ERR_BAD_DECISION_REPLY] Offending value: ${JSON.stringify(best)}. Expected a choice answer "${BEST_AREA}".`,
    );
  const ranked = Object.entries(best.probabilities)
    .map(([area, probability]) => ({ area, probability }))
    .sort((a, b) => b.probability - a.probability);
  const selected = areas
    .filter((area) => {
      const answer = reply.answers[hasKey(area.id)];
      return answer?.type === 'noul' && answer.noul >= threshold;
    })
    .map((area) => area.id);
  return { ranked, selected, best: best.choice };
}

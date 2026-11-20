import type { ToolDefinition } from '../../toolDefinition';
import type { DecisionAnswer, DecisionQuestion } from '../../../agent/systemOne';

/** Name of the question that picks the tool. */
export const BEST_TOOL = 'ferramenta';
const DESCRIPTION_LIMIT = 160;

const firstLine = (text: string): string => text.split('\n')[0].slice(0, DESCRIPTION_LIMIT);

/**
 * The question that picks, among every tool, the one that does what the request asks.
 *
 * Usage:
 *   toolQuestion(toolkit.tools()).type; // 'choice'
 */
export function toolQuestion(tools: ToolDefinition[]): DecisionQuestion {
  return {
    type: 'choice',
    instructions: 'Qual ferramenta faz o que o pedido pede? Se o pedido pede mais de uma coisa, a primeira.',
    criteria: Object.fromEntries(tools.map((tool) => [tool.name, firstLine(tool.description)])),
  };
}

/** The tools in the order of the decision model's probabilities, most likely first. */
export function rankedTools(answer: DecisionAnswer | undefined): string[] {
  if (answer?.type !== 'choice') return [];
  return Object.entries(answer.probabilities)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

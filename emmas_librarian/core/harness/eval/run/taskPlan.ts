import type { OpenAiTool } from '../../../agent/chatClient';

/** Version of the planning instructions: it goes into the run record, so runs are only compared if it matches. */
export const PLAN_PROMPT_VERSION = 'v3';

/** A request that needs more tasks than this is not a request a small model can plan. */
export const MAX_TASKS = 6;

/** The tool the model hands its plan in: a tool call has a shape, free text does not. */
export const PLAN_TOOL = 'submit_plan';

/** One step of the plan: what to do and the subject whose tools do it. */
export interface PlannedTask {
  area: string;
  task: string;
}

export interface AreaSummary {
  id: string;
  about: string;
}

/**
 * The instructions of the planning step: the model gets the subjects and one tool, submit_plan, to hand the tasks in.
 *
 * Usage:
 *   planInstructions([{ id: 'artigos', about: 'ler e anotar artigos' }]);
 */
export function planInstructions(areas: AreaSummary[]): string {
  const list = areas.map((area) => `- ${area.id}: ${area.about}`).join('\n');
  return [
    `Você planeja pedidos sobre a biblioteca de pesquisa. Agora você NÃO executa nada e não responde à pessoa: só entrega o plano chamando a ferramenta ${PLAN_TOOL}.`,
    'Cada tarefa tem um assunto (um dos ids abaixo) e uma frase dizendo o que fazer. Cada tarefa usa um só assunto.',
    `Divida o pedido em tarefas pequenas, na ordem em que devem acontecer. Se nenhum assunto serve ao pedido, chame ${PLAN_TOOL} com a lista de tarefas vazia.`,
    'Assuntos:',
    list,
  ].join('\n');
}

/**
 * The only tool of the planning step. The subject is an enum of the ids, so a plan cannot name a subject that does not
 * exist.
 *
 * Usage:
 *   planTool(['projetos', 'artigos']).function.name; // 'submit_plan'
 */
export function planTool(areaIds: string[]): OpenAiTool {
  const task = {
    type: 'object',
    properties: { assunto: { type: 'string', enum: areaIds }, tarefa: { type: 'string' } },
    required: ['assunto', 'tarefa'],
    additionalProperties: false,
  };
  return {
    type: 'function',
    function: {
      name: PLAN_TOOL,
      description: 'Entrega o plano do pedido: as tarefas, na ordem. Lista vazia se não há tarefa.',
      parameters: {
        type: 'object',
        properties: { tarefas: { type: 'array', maxItems: MAX_TASKS, items: task } },
        required: ['tarefas'],
        additionalProperties: false,
      },
    },
  };
}

const invalidPlan = (shown: string, why: string): Error =>
  new Error(
    `[ERR_INVALID_PLAN] Offending value: ${JSON.stringify(shown.slice(0, 300))}. ${why} Expected a ${PLAN_TOOL} call with { "tarefas": [{ "assunto": "<id>", "tarefa": "<texto>" }] }, at most ${MAX_TASKS} tasks.`,
  );

function taskFrom(item: unknown, known: readonly string[], shown: string): PlannedTask {
  const { assunto, tarefa } = (item ?? {}) as { assunto?: unknown; tarefa?: unknown };
  if (typeof assunto !== 'string' || !known.includes(assunto))
    throw invalidPlan(shown, `Subject ${JSON.stringify(assunto)} is not one of: ${known.join(', ')}.`);
  if (typeof tarefa !== 'string' || tarefa.trim() === '') throw invalidPlan(shown, 'A task has no text.');
  return { area: assunto, task: tarefa.trim() };
}

function tasksIn(argumentsText: string): unknown[] {
  try {
    const { tarefas } = JSON.parse(argumentsText) as { tarefas?: unknown };
    if (Array.isArray(tarefas)) return tarefas;
  } catch {
    // falls through to the error below, which carries the text
  }
  throw invalidPlan(argumentsText, 'The arguments have no "tarefas" list.');
}

/**
 * The tasks of a submit_plan call. A call that does not fit is the model's failure, so it throws instead of guessing.
 *
 * Usage:
 *   parsePlanCall('{"tarefas":[{"assunto":"artigos","tarefa":"ler o artigo 3"}]}', ['artigos']);
 */
export function parsePlanCall(argumentsText: string, known: readonly string[]): PlannedTask[] {
  const items = tasksIn(argumentsText);
  if (items.length > MAX_TASKS) throw invalidPlan(argumentsText, `The plan has ${items.length} tasks.`);
  return items.map((item) => taskFrom(item, known, argumentsText));
}

/**
 * The plan in a reply: the arguments of its submit_plan call. A reply with no such call (text, or another tool) fails
 * with what the model wrote.
 *
 * Usage:
 *   planFromReply(reply, ['projetos']); // [{ area: 'projetos', task: '...' }]
 */
export function planFromReply(
  reply: { content: string; toolCalls: Array<{ name: string; arguments: string }> },
  known: readonly string[],
): PlannedTask[] {
  const call = reply.toolCalls.find((c) => c.name === PLAN_TOOL);
  if (!call) throw invalidPlan(reply.content || JSON.stringify(reply.toolCalls), `No ${PLAN_TOOL} call.`);
  return parsePlanCall(call.arguments, known);
}

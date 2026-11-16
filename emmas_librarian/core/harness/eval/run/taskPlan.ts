/** Version of the planning instructions: it goes into the run record, so runs are only compared if it matches. */
export const PLAN_PROMPT_VERSION = 'v2';

/** A request that needs more tasks than this is not a request a small model can plan. */
export const MAX_TASKS = 6;

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
 * The instructions of the planning step: the model gets no tools, only the subjects, and answers with the list of tasks.
 *
 * Usage:
 *   planInstructions([{ id: 'artigos', about: 'ler e anotar artigos' }]);
 */
export function planInstructions(areas: AreaSummary[]): string {
  const list = areas.map((area) => `- ${area.id}: ${area.about}`).join('\n');
  return [
    'Você planeja pedidos sobre a biblioteca de pesquisa. Agora você NÃO executa nada e não responde à pessoa: só escreve o plano.',
    'Responda SÓ com uma lista JSON, sem texto em volta, em que cada item é uma tarefa:',
    '[{"assunto": "<id do assunto>", "tarefa": "<o que fazer, em uma frase>"}]',
    'Use como "assunto" só um dos ids abaixo, escrito exatamente igual. Cada tarefa usa um só assunto.',
    'Divida o pedido em tarefas pequenas, na ordem em que devem acontecer. Se nenhum assunto serve ao pedido, responda [].',
    'Nunca responda em texto: se não houver tarefa, a resposta é [].',
    'Assuntos:',
    list,
  ].join('\n');
}

const invalidPlan = (text: string, why: string): Error =>
  new Error(
    `[ERR_INVALID_PLAN] Offending value: ${JSON.stringify(text.slice(0, 300))}. ${why} Expected a JSON list like [{"assunto": "<id>", "tarefa": "<texto>"}] with at most ${MAX_TASKS} items.`,
  );

function listIn(text: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // falls through to the error below, which carries the text
  }
  throw invalidPlan(text, 'No JSON list found.');
}

function taskFrom(item: unknown, known: readonly string[], text: string): PlannedTask {
  const { assunto, tarefa } = (item ?? {}) as { assunto?: unknown; tarefa?: unknown };
  if (typeof assunto !== 'string' || !known.includes(assunto))
    throw invalidPlan(text, `Subject ${JSON.stringify(assunto)} is not one of: ${known.join(', ')}.`);
  if (typeof tarefa !== 'string' || tarefa.trim() === '') throw invalidPlan(text, 'A task has no text.');
  return { area: assunto, task: tarefa.trim() };
}

/**
 * The tasks a model wrote. A reply that is not a valid plan is the model's failure, so it throws instead of guessing.
 *
 * Usage:
 *   parsePlan('[{"assunto":"artigos","tarefa":"ler o artigo 3"}]', ['artigos']); // [{ area: 'artigos', task: '...' }]
 */
export function parsePlan(text: string, known: readonly string[]): PlannedTask[] {
  const items = listIn(text);
  if (items.length > MAX_TASKS) throw invalidPlan(text, `The plan has ${items.length} tasks.`);
  return items.map((item) => taskFrom(item, known, text));
}

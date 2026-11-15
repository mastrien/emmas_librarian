const EXPECTED = 'a list of non-empty texts such as ["Qual o método?","Qual a amostra?"], or its JSON text';

function invalidQuestions(value: unknown): Error {
  const shown = JSON.stringify(value)?.slice(0, 200) ?? String(value);
  return new Error(`[ERR_INVALID_QUESTIONS] Offending value: ${shown}. Expected ${EXPECTED}.`);
}

function asList(value: unknown): unknown[] {
  if (typeof value !== 'string') return Array.isArray(value) ? value : [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * The text stored in `question_sets.questions` (a JSON array) from what a caller sent: the list itself, or that
 * same JSON text, which the interface has always sent. Anything else is refused with the value received (#27).
 *
 * Usage:
 *   questionsToJson(['Qual o método?']); // '["Qual o método?"]'
 */
export function questionsToJson(value: string[] | string): string {
  const list = asList(value);
  const valid = list.length > 0 && list.every((q) => typeof q === 'string' && q.trim() !== '');
  if (!valid) throw invalidQuestions(value);
  return JSON.stringify(list);
}

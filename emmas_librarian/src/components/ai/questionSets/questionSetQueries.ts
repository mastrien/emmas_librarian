import type { QuestionSet } from '../../../types';

/**
 * The questions stored in a set, or null when the column is not a JSON array (a malformed row).
 *
 * @example setQuestions({ questions: '["A?", "B?"]' }) // ['A?', 'B?']
 */
export function setQuestions(set: Pick<QuestionSet, 'questions'>): string[] | null {
  try {
    const parsed: unknown = JSON.parse(set.questions);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

/**
 * How many questions a set has; a malformed row counts as zero.
 *
 * @example questionCountText({ questions: '["A?"]' }) // '1 pergunta'
 */
export function questionCountText(set: Pick<QuestionSet, 'questions'>): string {
  const count = setQuestions(set)?.length ?? 0;
  return `${count} ${count === 1 ? 'pergunta' : 'perguntas'}`;
}

/**
 * The questions worth saving: the editor keeps empty lines while the person types.
 *
 * @example filledQuestions(['A?', '  ']) // ['A?']
 */
export function filledQuestions(questions: string[]): string[] {
  return questions.filter((q) => q.trim().length > 0);
}

/**
 * When a set last changed, as a local date; a set without the column shows today, as it always did.
 *
 * @example updatedOnText('2026-03-01T10:00:00Z') // '01/03/2026' (pt-BR)
 */
export function updatedOnText(updatedAt: string | null | undefined, now: Date = new Date()): string {
  return (updatedAt ? new Date(updatedAt) : now).toLocaleDateString();
}

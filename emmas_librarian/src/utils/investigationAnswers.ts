import type { InvestigationResult, RAGExtractionResult, ReviewStatus } from '../types';

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  pending: 'pendente',
  accepted: 'aceita',
  edited: 'editada',
  rejected: 'rejeitada',
};

/**
 * The RAG answer stored as JSON in `answer`, or null for results saved as plain text (before RAG) or broken JSON.
 *
 * Usage:
 *   parseRagAnswer(result.answer)?.synthesizedAnswer
 */
export function parseRagAnswer(answer: string | null): RAGExtractionResult | null {
  if (!answer) return null;
  try {
    const parsed: unknown = JSON.parse(answer);
    const rag = parsed as RAGExtractionResult | null;
    return rag && typeof rag.synthesizedAnswer === 'string' ? rag : null;
  } catch {
    return null;
  }
}

/**
 * What the AI answered, as text: the synthesized answer of a RAG result, or the plain answer of an older one.
 *
 * Usage:
 *   aiAnswerText(result); // "Coorte retrospectiva com 1.200 pacientes"
 */
export function aiAnswerText(result: Pick<InvestigationResult, 'answer'>): string {
  return parseRagAnswer(result.answer)?.synthesizedAnswer ?? result.answer ?? '';
}

/**
 * The answer that counts after review (#47): the person's text when edited, nothing when rejected (so a rejected
 * answer never travels as valid), and the AI's answer while accepted or still pending.
 *
 * Usage:
 *   finalAnswerText({ ...result, review_status: 'rejected' }); // ""
 */
export function finalAnswerText(
  result: Pick<InvestigationResult, 'answer' | 'review_status' | 'reviewed_answer'>,
): string {
  if (result.review_status === 'edited') return result.reviewed_answer ?? '';
  if (result.review_status === 'rejected') return '';
  return aiAnswerText(result);
}

/**
 * Whether a correction can be saved: it has text and differs from the answer it started from. Saving the same
 * text counted as a correction, and an edited answer counts as wrong in the audit (validation of epic #44).
 *
 * @example canSaveCorrection('Coorte', 'Coorte ') // false
 */
export function canSaveCorrection(draft: string, initial: string): boolean {
  const text = draft.trim();
  return text.length > 0 && text !== initial.trim();
}

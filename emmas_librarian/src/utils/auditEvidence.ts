import type { InvestigationResult } from '../types';
import { parseRagAnswer } from './investigationAnswers';

/** One quote the AI cited for an answer, and its page when the answer recorded it. */
export interface AuditEvidenceItem {
  text: string;
  page?: number;
}

/**
 * The quotes behind an answer: the RAG evidences, or the single quote of a result saved before RAG.
 *
 * Usage:
 *   evidencesOf(result).map((e) => e.text);
 */
export function evidencesOf(result: InvestigationResult): AuditEvidenceItem[] {
  const rag = parseRagAnswer(result.answer);
  if (rag) return rag.evidences.filter((e) => e.text?.trim()).map((e) => ({ text: e.text, page: e.page }));
  return result.quote?.trim() ? [{ text: result.quote }] : [];
}

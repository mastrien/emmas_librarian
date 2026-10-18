import type { Annotation } from '../../types';
import { anchoredHighlight, anchorQuote, type AnchoringPdfDocument } from '../../utils/pdfTextSearch';
import { parseUnanchoredNote } from '../../utils/unanchoredNote';

export interface RetryAnchorDeps {
  openPdf: (pdfUrl: string) => Promise<AnchoringPdfDocument>;
  createHighlight: (
    articleId: number,
    color: string,
    positionData: unknown,
    contentText: string | null,
    annotationContent?: string,
  ) => Promise<unknown>;
  deleteAnnotation: (id: number) => Promise<void>;
}

export type RetryAnchorOutcome = 'anchored' | 'not-found' | 'unreadable-note';

/**
 * Tries again to place the quote of a "[Destaque não ancorado]" note in the PDF. When it now anchors, the highlight is
 * created first (with the note's comment) and only then the note removed, so the evidence is never lost in between.
 *
 * Usage:
 *   const outcome = await retryAnchorNote(articleId, pdfUrl, note, { openPdf, createHighlight, deleteAnnotation });
 */
export async function retryAnchorNote(
  articleId: number,
  pdfUrl: string,
  note: Annotation,
  deps: RetryAnchorDeps,
): Promise<RetryAnchorOutcome> {
  const parsed = parseUnanchoredNote(note.content_markdown);
  if (!parsed) return 'unreadable-note';
  const anchor = await anchorQuote(await deps.openPdf(pdfUrl), parsed.quote);
  if (!anchor) return 'not-found';
  const highlight = anchoredHighlight(0, parsed.quote, parsed.comment, anchor);
  await deps.createHighlight(articleId, highlight.color, highlight.position, parsed.quote, highlight.comment.text);
  await deps.deleteAnnotation(note.id);
  return 'anchored';
}

export const RETRY_ANCHOR_MESSAGES: Record<Exclude<RetryAnchorOutcome, 'anchored'>, string> = {
  'not-found':
    'A citação ainda não foi encontrada no PDF: o texto dela não aparece igual no documento (por exemplo, com sobrescritos ou palavras trocadas). A nota foi mantida.',
  'unreadable-note':
    'Esta nota foi editada e não tem mais a citação no formato original ("Citação no texto: ..."). A nota foi mantida.',
};

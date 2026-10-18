/**
 * The note the reader writes when an AI quote could not be placed in the PDF, so the evidence is not lost. It is a
 * plain annotation; this prefix is what tells it apart from the person's own notes.
 */
export const UNANCHORED_NOTE_PREFIX = '[Destaque não ancorado]';

const NOTE_PATTERN = /^\[Destaque não ancorado\]\n\nComentário: ([\s\S]*?)\n\nCitação no texto: "([\s\S]*)"\s*$/;

/**
 * The note for an AI quote that found no place in the PDF.
 *
 * Usage:
 *   projectService.createAnnotation(articleId, unanchoredNoteMarkdown(pending.comment, pending.quote));
 */
export function unanchoredNoteMarkdown(comment: string | null, quote: string): string {
  return `${UNANCHORED_NOTE_PREFIX}\n\nComentário: ${comment}\n\nCitação no texto: "${quote}"`;
}

/**
 * Whether an annotation is one of those notes (and so can be tried again as a highlight).
 *
 * Usage:
 *   isUnanchoredNote(annotation.content_markdown); // true
 */
export function isUnanchoredNote(markdown: string | null | undefined): boolean {
  return (markdown ?? '').startsWith(UNANCHORED_NOTE_PREFIX);
}

/**
 * The comment and the quote kept in such a note, or null when the note was edited out of shape.
 *
 * Usage:
 *   parseUnanchoredNote(annotation.content_markdown)?.quote;
 */
export function parseUnanchoredNote(markdown: string): { comment: string; quote: string } | null {
  const match = NOTE_PATTERN.exec(markdown);
  return match ? { comment: match[1], quote: match[2] } : null;
}

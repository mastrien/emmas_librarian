import type { Highlight } from '../../types';

/**
 * A highlight in the shape react-pdf-highlighter and the annotations sidebar read
 * (`position`, `content.text`, `comment.text`) — not the database row shape (`position_data`, `comment` string).
 * Mixing the two crashed the viewer ("Erro ao carregar o PDF") right after a highlight was created.
 */
export interface ViewerHighlight {
  id: string;
  article_id: number;
  /** react-pdf-highlighter ScaledPosition, stored as JSON in the database. */
  position: unknown;
  content: { text: string };
  comment: { text: string; emoji: string };
  color: string;
  annotation_id?: number | null;
}

/**
 * Converts a highlight row from the service into the viewer shape.
 *
 * Usage:
 *   setHighlights((await projectService.getHighlights(articleId)).map(toViewerHighlight));
 */
export function toViewerHighlight(row: Highlight): ViewerHighlight {
  return {
    id: String(row.id),
    article_id: row.article_id,
    position: row.position_data,
    content: { text: row.content_text || row.comment || '' },
    comment: { text: row.comment || '', emoji: '' },
    color: row.color || 'yellow',
    annotation_id: row.annotation_id,
  };
}

/**
 * The same highlight with its note text replaced (after editing the linked annotation).
 *
 * Usage:
 *   setHighlights(highlights.map((h) => (h.id === id ? withNote(h, text) : h)));
 */
export const withNote = (highlight: ViewerHighlight, text: string): ViewerHighlight => ({
  ...highlight,
  comment: { ...highlight.comment, text },
});

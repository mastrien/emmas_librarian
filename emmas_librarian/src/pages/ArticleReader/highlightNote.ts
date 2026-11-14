/**
 * The text of a highlight's note, always a string. The viewer stores `comment` as `{ text, emoji }` (the text is ''
 * when there is no note); older data may hold a plain string. Returning the object itself to the hover popup made
 * React throw "Objects are not valid as a React child", and PdfLoader shows any render error below it as "Erro ao
 * carregar o PDF": hovering a highlight blanked the reader (Arca 203).
 *
 * @example highlightNote({ comment: { text: 'ver cap. 3', emoji: '' } }) // 'ver cap. 3'
 * @example highlightNote({ comment: { text: '', emoji: '' } }) // ''
 */
export function highlightNote(highlight: { comment?: unknown }): string {
  const { comment } = highlight;
  if (typeof comment === 'string') return comment;
  if (comment && typeof comment === 'object') {
    const { text } = comment as { text?: unknown };
    return typeof text === 'string' ? text : '';
  }
  return '';
}

/**
 * A number of PDFs as a sentence says it.
 *
 * @example pdfCount(1) // '1 PDF'
 */
export const pdfCount = (count: number): string => (count === 1 ? '1 PDF' : `${count} PDFs`);

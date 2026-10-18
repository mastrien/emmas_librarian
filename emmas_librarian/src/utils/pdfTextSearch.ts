import * as pdfjsLib from 'pdfjs-dist';

import { PendingHighlight } from '../types';

/**
 * Normalizes a string to make PDF text matching more robust.
 * PDFs often encode ligatures (ﬁ, ﬂ), curly quotes and non-breaking
 * spaces differently from what an AI would reproduce in a verbatim quote.
 */
function normalizePdfText(str: string): string {
  return (
    str
      // Ligatures
      .replace(/ﬁ/g, 'fi')
      .replace(/ﬂ/g, 'fl')
      .replace(/ﬀ/g, 'ff')
      .replace(/ﬃ/g, 'ffi')
      .replace(/ﬄ/g, 'ffl')
      .replace(/ﬅ/g, 'ft')
      .replace(/ﬆ/g, 'st')
      // Curly/smart quotes → straight
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      // Non-breaking space, zero-width chars, BOM → regular space / empty
      // eslint-disable-next-line no-misleading-character-class
      .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ')
      // NFKC normalization handles accented chars encoded with combining diacritics
      .normalize('NFKC')
  );
}

// Hyphens and dashes of every kind are left out of the comparison, like spaces. A PDF breaks words at line ends
// ("forecas-" / "ts") that the AI quotes whole, and writes hyphens the AI copies as other code points (U+2010 in
// "semi‐arid"): 27 and 3 of the 80 AI quotes that failed in a real project (2026-10, precipitation forecasting).
const HYPHEN_LIKE = /[-\u00AD\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/;
// Punctuation is left out too: the AI re-types the quote instead of copying it, closing a sentence the text goes on
// with ("variability." for "variability (Fig. 2)"), dropping a comma, or writing "Stage II" in other quote marks
// (6 of the 12 quotes still unanchored after the hyphen and ellipsis rules). Ellipses are found before stripping.
const PUNCTUATION = /[.,;:!?'"()[\]]/;
// The AI shortens long quotes with "..." (26 of those 80); each part is then looked for in order.
const ELLIPSIS = /\.\.\.|…/;
// Shorter parts around an ellipsis ("et al.", "(Fig. 1)") match too many places to locate anything.
const MIN_SEGMENT_LENGTH = 12;

/** One text item of a pdf.js page, as far as anchoring needs it. */
export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}

/** A page's text with spaces, hyphens and punctuation removed, and where each kept character came from. */
export interface PageTextIndex {
  stripped: string;
  strippedToOriginal: number[];
  items: { startIndex: number; endIndex: number; item: PdfTextItem }[];
}

/** A run of the stripped page text, end exclusive. */
export interface StrippedRange {
  start: number;
  end: number;
}

export interface AnchorRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
}

const isSkipped = (char: string): boolean => /\s/.test(char) || HYPHEN_LIKE.test(char) || PUNCTUATION.test(char);

/**
 * The comparable form of a quote or context: normalized, lower case, without spaces, hyphens and punctuation.
 *
 * Usage:
 *   stripForMatching('Precipi-\ntação  Média'); // "precipitaçãomédia"
 */
export function stripForMatching(text: string): string {
  return [...normalizePdfText(text).toLowerCase()].filter((char) => !isSkipped(char)).join('');
}

/**
 * Indexes one page's text items for anchoring.
 *
 * Usage:
 *   const index = buildPageIndex((await page.getTextContent()).items as PdfTextItem[]);
 */
export function buildPageIndex(items: PdfTextItem[]): PageTextIndex {
  const index: PageTextIndex = { stripped: '', strippedToOriginal: [], items: [] };
  let length = 0;
  for (const item of items) {
    const str = item.str + (item.hasEOL ? '\n' : '');
    index.items.push({ startIndex: length, endIndex: length + str.length, item });
    [...str].forEach((char, i) => appendChar(index, char, length + i));
    length += str.length;
  }
  return index;
}

function appendChar(index: PageTextIndex, char: string, originalIndex: number): void {
  if (isSkipped(char)) return;
  const normalized = stripForMatching(char);
  index.stripped += normalized;
  for (let j = 0; j < normalized.length; j++) index.strippedToOriginal.push(originalIndex);
}

/**
 * The parts of a quote to look for: the whole quote, or the parts between the AI's ellipses that are long enough
 * to locate (falling back to the whole quote when none is).
 *
 * Usage:
 *   quoteSegments('We use ERA5 data ... from 1996 to 2022'); // ["weuseera5data", "from1996to2022"]
 */
export function quoteSegments(quote: string): string[] {
  const parts = quote.split(ELLIPSIS).map(stripForMatching);
  const located = parts.filter((part) => part.length >= MIN_SEGMENT_LENGTH);
  if (parts.length > 1 && located.length > 0) return located;
  const whole = stripForMatching(quote.replace(new RegExp(ELLIPSIS.source, 'g'), ''));
  return whole ? [whole] : [];
}

function occurrences(text: string, needle: string): number[] {
  const found: number[] = [];
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) found.push(at);
  return found;
}

// One unique place for a single-part quote; context (when saved) picks among repeated ones.
function locateWhole(stripped: string, quote: string, context?: { before: string; after: string }) {
  let matches = occurrences(stripped, quote);
  if (matches.length > 1 && context?.before && context.after) {
    const at = stripped.indexOf(context.before + quote + context.after);
    if (at !== -1) matches = [at + context.before.length];
  }
  return matches.length === 1 ? [{ start: matches[0], end: matches[0] + quote.length }] : null;
}

// A quote with ellipses: each part after the previous one, all on the same page.
function locateInOrder(stripped: string, segments: string[]): StrippedRange[] | null {
  const ranges: StrippedRange[] = [];
  let from = 0;
  for (const segment of segments) {
    const at = stripped.indexOf(segment, from);
    if (at === -1) return null;
    ranges.push({ start: at, end: at + segment.length });
    from = at + segment.length;
  }
  return ranges;
}

/**
 * Where a quote sits in one page's stripped text, or null when it is not there (or, for a quote without ellipses,
 * not there exactly once).
 *
 * Usage:
 *   locateQuote(index.stripped, 'precipitation forecasts', { before: '', after: '' });
 */
export function locateQuote(
  stripped: string,
  quote: string,
  context?: { before: string; after: string },
): StrippedRange[] | null {
  const segments = quoteSegments(quote);
  if (segments.length === 0) return null;
  if (segments.length > 1) return locateInOrder(stripped, segments);
  const strippedContext = context && {
    before: stripForMatching(context.before),
    after: stripForMatching(context.after),
  };
  return locateWhole(stripped, segments[0], strippedContext);
}

/**
 * The rectangles of the text items a located quote covers, in the page's own coordinates.
 *
 * Usage:
 *   rectsForRanges(index, ranges, { width: 595, height: 842 });
 */
export function rectsForRanges(
  index: PageTextIndex,
  ranges: StrippedRange[],
  page: { width: number; height: number },
): AnchorRect[] {
  const covered = new Set<PageTextIndex['items'][number]>();
  for (const { start, end } of ranges) {
    const matchStart = index.strippedToOriginal[start];
    const matchEnd = index.strippedToOriginal[end - 1] + 1;
    index.items.filter((m) => m.startIndex < matchEnd && m.endIndex > matchStart).forEach((m) => covered.add(m));
  }
  return [...covered].map(({ item }) => {
    const x = item.transform[4];
    const y = page.height - item.transform[5]; // pdfjs y is from bottom
    return { x1: x, y1: y - item.height, x2: x + item.width, y2: y, width: page.width, height: page.height };
  });
}

/** The part of pdf.js's document anchoring reads. */
export interface AnchoringPdfDocument {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number };
    getTextContent: () => Promise<{ items: unknown[] }>;
  }>;
}

export interface QuoteAnchor {
  pageNumber: number;
  rects: AnchorRect[];
}

/**
 * Finds a quote in a PDF and returns where to draw it: the first page where it is located, or null.
 *
 * Usage:
 *   const anchor = await anchorQuote(pdfDoc, 'precipitation forecasts');
 */
export async function anchorQuote(
  pdfDoc: AnchoringPdfDocument,
  quote: string,
  context?: { before: string; after: string },
): Promise<QuoteAnchor | null> {
  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
    const page = await pdfDoc.getPage(pageNumber);
    const index = buildPageIndex((await page.getTextContent()).items as PdfTextItem[]);
    const ranges = locateQuote(index.stripped, quote, context);
    if (!ranges) continue;
    const rects = rectsForRanges(index, ranges, page.getViewport({ scale: 1 }));
    if (rects.length > 0) return { pageNumber, rects };
  }
  return null;
}

/**
 * Opens a PDF for anchoring quotes in it.
 *
 * Usage:
 *   const pdfDoc = await openPdfForAnchoring(blobUrl);
 */
export async function openPdfForAnchoring(pdfUrl: string): Promise<AnchoringPdfDocument> {
  const pdfDoc = await pdfjsLib.getDocument({
    url: pdfUrl,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/standard_fonts/',
  }).promise;
  return pdfDoc as unknown as AnchoringPdfDocument;
}

/**
 * The reader-ready highlight for an anchored AI quote.
 *
 * Usage:
 *   anchoredHighlight(pending.id, pending.quote, pending.comment, anchor);
 */
export function anchoredHighlight(pendingId: number, quote: string, comment: string | null, anchor: QuoteAnchor) {
  return {
    pendingId,
    content: { text: quote },
    position: { boundingRect: anchor.rects[0], rects: anchor.rects, pageNumber: anchor.pageNumber },
    comment: { text: comment || 'Destacado pela IA', emoji: '🤖' },
    color: '#fde047', // yellow
  };
}

export async function anchorPendingHighlights(
  pdfUrl: string,
  pendingHighlights: PendingHighlight[],
  setStatus: (msg: string) => void,
) {
  if (!pendingHighlights || pendingHighlights.length === 0) return { anchoredHighlights: [], unanchoredHighlights: [] };

  setStatus('Abrindo documento para ancorar destaques...');
  const pdfDoc = await openPdfForAnchoring(pdfUrl);
  const anchoredHighlights = [];
  const unanchoredHighlights = [];

  for (const pending of pendingHighlights) {
    if (!pending.quote) continue;
    setStatus(`Buscando citação: "${pending.quote.substring(0, 30)}..."`);
    const context = { before: pending.context_before ?? '', after: pending.context_after ?? '' };
    const anchor = await anchorQuote(pdfDoc, pending.quote, context);
    if (anchor) anchoredHighlights.push(anchoredHighlight(pending.id, pending.quote, pending.comment, anchor));
    else unanchoredHighlights.push(pending);
  }

  setStatus('');
  return { anchoredHighlights, unanchoredHighlights };
}

/**
 * How a quote written by the AI is compared with a PDF's text (PR #62): normalized, lower case, without spaces,
 * hyphens and punctuation, and split at the AI's ellipses. No pdf.js here, so the reader and the main process's
 * extraction (#63) share the same rules.
 */

/**
 * Normalizes a string to make PDF text matching more robust.
 * PDFs often encode ligatures (ﬁ, ﬂ), curly quotes and non-breaking
 * spaces differently from what an AI would reproduce in a verbatim quote.
 */
export function normalizePdfText(str: string): string {
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

export const isSkipped = (char: string): boolean => /\s/.test(char) || HYPHEN_LIKE.test(char) || PUNCTUATION.test(char);

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

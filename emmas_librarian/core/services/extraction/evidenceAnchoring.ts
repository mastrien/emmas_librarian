import { isSkipped, quoteSegments, stripForMatching } from '../../../src/utils/quoteMatching';

/** A chunk as the extraction gives it to the AI: its text, page, box on the page and retrieval score. */
export interface ExtractionChunk {
  text: string;
  page: number;
  bbox?: { x: number; y: number; w: number; h: number } | null;
  score: number;
}

/**
 * An evidence after anchoring: `text` is copied from the chunk the AI read. `match` says how: "exact" when the
 * AI's text was found in the chunk (only that part is kept), "chunk" when it was not and the whole chunk stands
 * for it, "none" when there was no chunk at all. `aiText` keeps what the AI wrote.
 */
export interface AnchoredEvidence {
  text: string;
  page: number;
  bbox: ExtractionChunk['bbox'] | null;
  score: number;
  reasoning?: string;
  aiText: string;
  match: 'exact' | 'chunk' | 'none';
}

/** An evidence as the AI answers it. */
export interface AiEvidence {
  text?: unknown;
  page?: unknown;
  score?: unknown;
  reasoning?: unknown;
}

// The chunk's comparable text and, for each of its characters, where the chunk character it came from starts
// and ends (UTF-16 offsets, so a math letter such as "𝑥", two code units, is cut whole).
function strippedWithOrigins(text: string): { stripped: string; starts: number[]; ends: number[] } {
  let stripped = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const char of text) {
    const piece = isSkipped(char) ? '' : stripForMatching(char);
    stripped += piece;
    for (let j = 0; j < piece.length; j++) {
      starts.push(offset);
      ends.push(offset + char.length);
    }
    offset += char.length;
  }
  return { stripped, starts, ends };
}

/**
 * Where the AI's quote sits in a chunk, as a slice of the chunk's own text, or null. A quote cut with "..." is
 * found part after part, and the slice runs from the first part to the last (#63, rules of PR #62).
 *
 * @example locateInChunk('rain ... fell', 'The rain then fell.') // { start: 4, end: 18 }
 */
export function locateInChunk(quote: string, chunkText: string): { start: number; end: number } | null {
  const segments = quoteSegments(quote);
  if (!segments.length) return null;
  const { stripped, starts, ends } = strippedWithOrigins(chunkText);
  let from = 0;
  let first = -1;
  for (const segment of segments) {
    const at = stripped.indexOf(segment, from);
    if (at === -1) return null;
    if (first === -1) first = at;
    from = at + segment.length;
  }
  return { start: starts[first], end: ends[from - 1] };
}

const words = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);

// The chunk sharing most words with the AI's text; on a tie the earlier (better ranked) one.
function closestChunk(quote: string, chunks: ExtractionChunk[]): ExtractionChunk {
  const wanted = words(quote);
  const overlap = (c: ExtractionChunk) => [...words(c.text)].filter((w) => wanted.has(w)).length;
  return chunks.reduce((best, c) => (overlap(c) > overlap(best) ? c : best), chunks[0]);
}

/**
 * Anchors an evidence to the chunks the AI read (#63, option 2 as amended by the author): the AI's text is
 * looked for in the chunks of its page first, then in the others; found, only that part of the chunk is kept,
 * copied from the PDF; not found, the closest chunk (its page first) is kept whole instead of losing the evidence.
 *
 * @example anchorEvidence({ text: 'rain fell', page: 2 }, chunks).match // 'exact'
 */
export function anchorEvidence(ev: AiEvidence, chunks: ExtractionChunk[]): AnchoredEvidence {
  const aiText = typeof ev.text === 'string' ? ev.text : '';
  const reasoning = typeof ev.reasoning === 'string' ? ev.reasoning : undefined;
  const page = typeof ev.page === 'number' ? ev.page : NaN;
  const keep = (chunk: ExtractionChunk, text: string, match: AnchoredEvidence['match']): AnchoredEvidence => ({
    text,
    page: chunk.page,
    // As before #63: a box without width cannot be drawn, so none is kept.
    bbox: chunk.bbox && chunk.bbox.w > 0 ? chunk.bbox : null,
    score: typeof ev.score === 'number' ? ev.score : Number(chunk.score.toFixed(2)),
    reasoning,
    aiText,
    match,
  });
  if (!chunks.length)
    return { text: aiText, page, bbox: null, score: Number(ev.score) || 0, reasoning, aiText, match: 'none' };
  const samePage = chunks.filter((c) => c.page === page);
  for (const chunk of [...samePage, ...chunks.filter((c) => c.page !== page)]) {
    const at = locateInChunk(aiText, chunk.text);
    if (at) return keep(chunk, chunk.text.slice(at.start, at.end), 'exact');
  }
  const fallback = closestChunk(aiText, samePage.length ? samePage : chunks);
  return keep(fallback, fallback.text, 'chunk');
}

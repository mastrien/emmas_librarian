import { describe, it, expect } from 'vitest';
import { anchorEvidence, locateInChunk, type ExtractionChunk } from '../evidenceAnchoring';
import { quotePrompt } from '../extractionPrompts';

const slice = (quote: string, text: string) => {
  const at = locateInChunk(quote, text);
  return at ? text.slice(at.start, at.end) : null;
};

describe('locateInChunk (#63, rules of PR #62)', () => {
  it('finds a quote the AI re-typed: joined hyphenation, other hyphens, edited punctuation', () => {
    const text = 'The fore- cast skill of the semi‐arid basins improved (Fig. 2), as expected.';

    expect(slice('forecast skill of the semi-arid basins improved.', text)).toBe(
      'fore- cast skill of the semi‐arid basins improved',
    );
  });

  it('finds a quote cut with an ellipsis part after part, and copies everything between', () => {
    const text = 'Correlation is increased from 67% This is an open access article (footer) for the period up to 77%.';

    expect(slice('increased from 67% ... for the period up to 77%', text)).toBe(
      'increased from 67% This is an open access article (footer) for the period up to 77%',
    );
  });

  // PR #62: a part shorter than 12 characters matches too many places, so only the long part is located.
  it('keeps only the long part when the other side of the ellipsis is too short to locate', () => {
    expect(slice('increased from 67% ... to 77%', 'Correlation is increased from 67% (footer) to 77%.')).toBe(
      'increased from 67%',
    );
  });

  it('cuts a math letter of two code units whole, and matches a ligature', () => {
    expect(slice('where x is the rain', 'Let 𝑥 is no; where 𝑥 is the rain.')).toBe('where 𝑥 is the rain');
    expect(slice('the first field', 'In the ﬁrst ﬁeld.')).toBe('the ﬁrst ﬁeld');
  });

  it('answers null when a part is missing or comes in the wrong order', () => {
    expect(slice('drought index', 'A rainfall record.')).toBeNull();
    expect(slice('to 77% ... from 67%', 'from 67% up to 77%')).toBeNull();
    expect(slice('', 'anything')).toBeNull();
  });
});

const CHUNKS: ExtractionChunk[] = [
  { text: 'ERA5 has hourly output.', page: 2, bbox: { x: 1, y: 2, w: 3, h: 4 }, score: 0.9 },
  { text: 'The model uses radar reflectivity data.', page: 5, bbox: { x: 0, y: 0, w: 0, h: 0 }, score: 0.456 },
  { text: 'Radar data were quality controlled.', page: 5, bbox: { x: 5, y: 5, w: 5, h: 5 }, score: 0.3 },
];

describe('anchorEvidence (#63, option 2 as amended)', () => {
  it('copies the part of the chunk the AI quoted, keeping what it wrote', () => {
    expect(anchorEvidence({ text: 'ERA5 has hourly-output', page: 2, score: 0.7, reasoning: 'r' }, CHUNKS)).toEqual({
      text: 'ERA5 has hourly output',
      page: 2,
      bbox: { x: 1, y: 2, w: 3, h: 4 },
      score: 0.7,
      reasoning: 'r',
      aiText: 'ERA5 has hourly-output',
      match: 'exact',
    });
  });

  it('looks in the other pages when the page the AI gave is wrong, and takes the score of the chunk', () => {
    expect(anchorEvidence({ text: 'radar reflectivity data', page: 2 }, CHUNKS)).toMatchObject({
      text: 'radar reflectivity data',
      page: 5,
      bbox: null,
      score: 0.46,
      match: 'exact',
    });
  });

  it('keeps the closest chunk of the page whole when the quote cannot be found', () => {
    expect(anchorEvidence({ text: 'radar data were checked for quality', page: 5 }, CHUNKS)).toMatchObject({
      text: 'Radar data were quality controlled.',
      page: 5,
      match: 'chunk',
      aiText: 'radar data were checked for quality',
    });
  });

  it('falls back to any chunk when none is on the given page, and keeps the text when there are no chunks', () => {
    expect(anchorEvidence({ text: 'hourly ERA5 fields', page: 9 }, CHUNKS)).toMatchObject({ page: 2, match: 'chunk' });
    expect(anchorEvidence({ text: 'algo', page: 1 }, [])).toMatchObject({ text: 'algo', match: 'none' });
  });
});

describe('quotePrompt (#63)', () => {
  it('shows each chunk with its page and score and asks for the exact text', () => {
    const prompt = quotePrompt('Qual a base?', CHUNKS);

    expect(prompt).toContain('"text": "trecho EXATO e COMPLETO do texto original');
    expect(prompt).toContain('[Trecho 2 - Página 5 - Score: 0.46]\nThe model uses radar reflectivity data.');
  });
});

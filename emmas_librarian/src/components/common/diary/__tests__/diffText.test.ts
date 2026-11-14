import { describe, it, expect } from 'vitest';
import { changeSummary, diffWords, lineChanges, type DiffPart } from '../diffText';

const joined = (parts: DiffPart[], ...kinds: DiffPart['kind'][]) =>
  parts
    .filter((p) => kinds.includes(p.kind))
    .map((p) => p.text)
    .join('');

describe('diffWords', () => {
  it('marks what went out and what came in, word by word', () => {
    expect(diffWords('a b c', 'a x c')).toEqual([
      { text: 'a ', kind: 'same' },
      { text: 'b', kind: 'del' },
      { text: 'x', kind: 'add' },
      { text: ' c', kind: 'same' },
    ]);
  });

  it('gives back each text when its own pieces are joined', () => {
    const from = 'Incluir: previsão de precipitação em escala de dias.\nExcluir: estudos sem dados.';
    const to =
      'Incluir: previsão de precipitação em escala de dias a meses; validação contra observação.\nExcluir: estudos sem dados de estação.';

    const parts = diffWords(from, to);

    expect(joined(parts, 'same', 'del')).toBe(from);
    expect(joined(parts, 'same', 'add')).toBe(to);
  });

  it('is one piece when the texts are equal, and nothing when both are empty', () => {
    expect(diffWords('igual', 'igual')).toEqual([{ text: 'igual', kind: 'same' }]);
    expect(diffWords('', '')).toEqual([]);
  });

  it('shows a text that only grew as additions, and one that only shrank as deletions', () => {
    expect(diffWords('', 'novo')).toEqual([{ text: 'novo', kind: 'add' }]);
    expect(diffWords('velho', '')).toEqual([{ text: 'velho', kind: 'del' }]);
  });

  it('keeps line breaks', () => {
    const parts = diffWords('um\n\ndois', 'um\n\ndois\n\ntrês');

    expect(joined(parts, 'same', 'add')).toBe('um\n\ndois\n\ntrês');
  });

  it('shows a very different long text as replaced whole instead of doing a table of millions of cells', () => {
    const words = (prefix: string) => Array.from({ length: 2500 }, (_, i) => `${prefix}${i}`).join(' ');

    const parts = diffWords(words('a'), words('b'));

    expect(parts.map((p) => p.kind)).toEqual(['del', 'add']);
  });
});

describe('lineChanges', () => {
  it('counts the lines each text has that the other does not', () => {
    expect(lineChanges('a\nb', 'a\nc\nd')).toEqual({ removed: 1, added: 2 });
  });

  it('ignores blank lines and the spaces around a line, and counts a repeated line each time', () => {
    expect(lineChanges('a\n\n  b  \na', 'a\nb')).toEqual({ removed: 1, added: 0 });
  });
});

describe('changeSummary', () => {
  it('says what a version lacks and what it has less, in singular and plural', () => {
    expect(changeSummary('a\nb', 'a\nc')).toBe('−1 linha, +1 linha');
    expect(changeSummary('a\nb\nc', 'a')).toBe('−2 linhas');
    expect(changeSummary('a', 'a\nb\nc')).toBe('+2 linhas');
  });

  it('says when it is the same as the current text', () => {
    expect(changeSummary('a\nb', 'a\nb')).toBe('igual à atual');
  });
});

import { describe, it, expect } from 'vitest';
import { highlightNote } from '../highlightNote';

describe('highlightNote', () => {
  it('reads the text of the viewer comment object', () => {
    expect(highlightNote({ comment: { text: 'ver cap. 3', emoji: '' } })).toBe('ver cap. 3');
  });

  // Regression (Arca 203): the empty comment object reached the popup and React threw while rendering it.
  it('gives an empty string, never the object, for a highlight without a note', () => {
    expect(highlightNote({ comment: { text: '', emoji: '' } })).toBe('');
    expect(highlightNote({ comment: { emoji: '' } })).toBe('');
  });

  it('accepts a plain string and a missing comment', () => {
    expect(highlightNote({ comment: 'nota' })).toBe('nota');
    expect(highlightNote({})).toBe('');
    expect(highlightNote({ comment: null })).toBe('');
  });
});

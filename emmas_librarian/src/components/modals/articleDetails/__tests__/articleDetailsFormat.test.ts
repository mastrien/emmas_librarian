import { describe, it, expect } from 'vitest';
import { formatVolumeIssuePages, splitSemicolonList } from '../articleDetailsFormat';

describe('formatVolumeIssuePages', () => {
  it.each([
    [{ volume: '1', issue: '2', pages: '3-4' }, 'v. 1, n. 2, p. 3-4'],
    [{ issue: '2', pages: '9' }, 'n. 2, p. 9'],
    [{ pages: '9' }, 'p. 9'],
    [{ volume: '', issue: undefined, pages: '' }, 'N/A'],
  ])('%o -> %s', (article, expected) => {
    expect(formatVolumeIssuePages(article)).toBe(expected);
  });
});

describe('splitSemicolonList', () => {
  it('trims entries and drops blanks', () => {
    expect(splitSemicolonList(' a ; ;b;')).toEqual(['a', 'b']);
  });

  it('returns an empty list for missing values', () => {
    expect(splitSemicolonList(undefined)).toEqual([]);
    expect(splitSemicolonList('')).toEqual([]);
  });
});

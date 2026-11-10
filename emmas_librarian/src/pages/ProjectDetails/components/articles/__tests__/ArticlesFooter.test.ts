import { describe, expect, it } from 'vitest';
import { pageRangeLabel } from '../ArticlesFooter';

describe('pageRangeLabel', () => {
  it('gives the rows of a page, the last one cut at the count', () => {
    expect(pageRangeLabel(1, 50, 96)).toBe('1–50 de 96');
    expect(pageRangeLabel(2, 50, 96)).toBe('51–96 de 96');
  });
});

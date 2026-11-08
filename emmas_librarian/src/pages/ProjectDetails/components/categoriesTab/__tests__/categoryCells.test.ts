import { describe, it, expect } from 'vitest';
import { categoryCellText, type ProjectArticleCategory } from '../categoryCells';

const value = (article_id: number, category_id: number, v?: string): ProjectArticleCategory => ({
  article_id,
  category_id,
  name: 'C',
  type: 'text',
  value: v,
});

describe('category cells (Arca 134)', () => {
  it('shows yes/no in words, the value as it is, or a dash', () => {
    const values = [value(1, 1, 'true'), value(1, 2, 'false'), value(1, 3, 'Brasil'), value(1, 4, '')];

    expect([1, 2, 3, 4, 5].map((cat) => categoryCellText(values, 1, cat))).toEqual(['Sim', 'Não', 'Brasil', '-', '-']);
  });
});

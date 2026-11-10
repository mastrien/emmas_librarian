import { describe, expect, it } from 'vitest';
import { categoryTypeLabel, filledCategories, filledCount, matrixCell, matrixRows } from '../categoryMatrix';
import type { Article, ArticleCategory, ProjectCategory } from '../../../../../types';

const category = (id: number, type: string): ProjectCategory => ({ id, project_id: 1, name: `C${id}`, type });
const value = (article_id: number, category_id: number, v: string): ArticleCategory =>
  ({ article_id, category_id, value: v, name: '', type: '' }) as ArticleCategory;
const article = (id: number, title = `Artigo ${id}`) => ({ id, project_id: 1, title }) as Article;

const LIST = category(1, 'multiselect');
const YESNO = category(2, 'boolean');
const TEXT = category(3, 'text');
const values = [value(10, 1, 'LSTM, Random Forest'), value(10, 2, 'false'), value(11, 3, 'Brasil'), value(11, 2, '')];

describe('matrixCell', () => {
  it('shows a list as its options, a yes/no as Sim or Não, and text as text', () => {
    expect(matrixCell(values, 10, LIST)).toEqual({ kind: 'list', items: ['LSTM', 'Random Forest'] });
    expect(matrixCell(values, 10, YESNO)).toEqual({ kind: 'yesno', yes: false });
    expect(matrixCell(values, 11, TEXT)).toEqual({ kind: 'text', text: 'Brasil' });
  });

  it('is empty when there is no value or only a blank one', () => {
    expect(matrixCell(values, 12, TEXT)).toEqual({ kind: 'empty' });
    expect(matrixCell(values, 11, YESNO)).toEqual({ kind: 'empty' });
  });
});

describe('counts', () => {
  it('counts the filled articles of a column and the filled columns of an article', () => {
    expect(filledCount(values, [article(10), article(11), article(12)], YESNO)).toBe(1);
    expect(filledCategories(values, 10, [LIST, YESNO, TEXT])).toBe(2);
  });
});

describe('matrixRows', () => {
  const articles = [article(12, 'Sem nada'), article(11, 'Com texto'), article(10, 'Com lista ERA5')];

  it('puts the articles with more values first, keeping the order of the rest', () => {
    const rows = matrixRows(articles, values, [LIST, YESNO, TEXT], { query: '', order: 'filled-first' });
    expect(rows.map((a) => a.id)).toEqual([10, 11, 12]);
  });

  it('keeps the project order on request and filters by title', () => {
    expect(matrixRows(articles, values, [LIST], { query: '', order: 'project' }).map((a) => a.id)).toEqual([
      12, 11, 10,
    ]);
    expect(matrixRows(articles, values, [LIST], { query: 'era5', order: 'project' }).map((a) => a.id)).toEqual([10]);
  });
});

describe('categoryTypeLabel', () => {
  it('names each kind of category', () => {
    expect(categoryTypeLabel('enum')).toBe('Lista');
    expect(categoryTypeLabel('multiselect')).toBe('Várias opções');
  });
});

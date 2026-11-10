import type { Article, ProjectCategory } from '../../../../types';
import type { ProjectArticleCategory } from './categoryCells';

// The categories matrix (redesign, board 156): one column per category, one row per article, each cell shown by
// its kind (chips for lists, Sim/Não, text) and counted per column.

export type MatrixCell =
  | { kind: 'empty' }
  | { kind: 'yesno'; yes: boolean }
  | { kind: 'list'; items: string[] }
  | { kind: 'text'; text: string };

const TYPE_LABELS: Record<string, string> = {
  text: 'Texto',
  boolean: 'Sim ou não',
  enum: 'Lista',
  multiselect: 'Várias opções',
};

/**
 * The kind of a category as the column header says it.
 *
 * @example categoryTypeLabel('boolean') // 'Sim ou não'
 */
export function categoryTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? 'Texto';
}

const findValue = (values: ProjectArticleCategory[], articleId: number, categoryId: number) =>
  values.find((v) => Number(v.article_id) === Number(articleId) && Number(v.category_id) === Number(categoryId))
    ?.value ?? '';

/**
 * What one cell shows: nothing yet, Sim/Não, the chosen options as a list, or the text.
 *
 * @example matrixCell(values, 12, { id: 3, type: 'multiselect' } as ProjectCategory) // { kind: 'list', items: ['LSTM', 'RF'] }
 */
export function matrixCell(values: ProjectArticleCategory[], articleId: number, category: ProjectCategory): MatrixCell {
  const value = findValue(values, articleId, category.id).trim();
  if (!value) return { kind: 'empty' };
  if (category.type === 'boolean')
    return value === 'true' || value === 'false' ? { kind: 'yesno', yes: value === 'true' } : { kind: 'empty' };
  if (category.type === 'multiselect' || category.type === 'enum') {
    return {
      kind: 'list',
      items: value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    };
  }
  return { kind: 'text', text: value };
}

const isFilled = (values: ProjectArticleCategory[], articleId: number, category: ProjectCategory) =>
  matrixCell(values, articleId, category).kind !== 'empty';

/**
 * How many of the listed articles have a value in a category (the "3/96" of the header).
 *
 * @example filledCount(values, articles, category) // 3
 */
export function filledCount(values: ProjectArticleCategory[], articles: Article[], category: ProjectCategory): number {
  return articles.filter((a) => isFilled(values, a.id, category)).length;
}

/**
 * How many categories of an article have a value.
 *
 * @example filledCategories(values, 12, categories) // 2
 */
export function filledCategories(
  values: ProjectArticleCategory[],
  articleId: number,
  categories: ProjectCategory[],
): number {
  return categories.filter((c) => isFilled(values, articleId, c)).length;
}

export type MatrixOrder = 'filled-first' | 'project';

/**
 * The rows to show: the articles whose title matches, those with more values first when asked (the rest keep the
 * project's order).
 *
 * @example matrixRows(articles, values, categories, { query: 'era5', order: 'filled-first' })
 */
export function matrixRows(
  articles: Article[],
  values: ProjectArticleCategory[],
  categories: ProjectCategory[],
  view: { query: string; order: MatrixOrder },
): Article[] {
  const query = view.query.trim().toLowerCase();
  const matching = query ? articles.filter((a) => (a.title ?? '').toLowerCase().includes(query)) : articles;
  if (view.order === 'project') return matching;
  const filled = (a: Article) => filledCategories(values, a.id, categories);
  return [...matching].sort((a, b) => filled(b) - filled(a));
}

import type { ArticleCategory } from '../../../../types';

/** A category value of one article, as the project lists them all at once (article_id is set). */
export type ProjectArticleCategory = ArticleCategory;

/**
 * What the categories table shows for one article and category: "Sim"/"Não" for yes/no categories, the value, or
 * "-" when there is none.
 *
 * @example categoryCellText(values, 12, 3) // 'Sim'
 */
export function categoryCellText(values: ProjectArticleCategory[], articleId: number, categoryId: number): string {
  const found = values.find(
    (v) => Number(v.article_id) === Number(articleId) && Number(v.category_id) === Number(categoryId),
  );
  if (found?.value === 'true') return 'Sim';
  if (found?.value === 'false') return 'Não';
  return found?.value || '-';
}

import type { Article, SearchPreviewItem } from '../../../types';

/**
 * Shapes an unsaved search result as an Article so ArticleDetailsModal can show it. It has no id
 * or project yet (both 0), and is never written anywhere.
 *
 * @example <ArticleDetailsModal isOpen article={previewItemToArticle(item)} isSearchResult onClose={close} />
 */
export function previewItemToArticle(item: SearchPreviewItem): Article {
  return {
    id: 0,
    project_id: 0,
    status: 'new',
    title: item.title,
    authors: item.authors,
    year: item.year,
    doi: item.doi,
    source_databases: JSON.stringify(item.sourceDatabases),
    ...item.details,
  };
}

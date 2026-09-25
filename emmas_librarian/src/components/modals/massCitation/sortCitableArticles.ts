import { parseAuthors } from '../../../services/citationService';
import type { CitableArticle } from '../../../utils/cslMetadata';

export type CitationSortOrder = 'author' | 'year';

// Bibliographies are ordered by surname, so compare the first author's family name (literal for institutions).
const firstAuthorSurname = (authors: string) => {
  const [first] = parseAuthors(authors);
  return first?.family || first?.literal || '';
};

const byAuthor = (a: CitableArticle, b: CitableArticle) =>
  firstAuthorSurname(a.authors).localeCompare(firstAuthorSurname(b.authors), 'pt-BR');

// Articles without a year sort first, as year 0.
const byYear = (a: CitableArticle, b: CitableArticle) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0);

/**
 * A sorted copy of the articles for the reference list.
 *
 * Usage:
 *   const ordered = sortCitableArticles(articles, 'year');
 */
export function sortCitableArticles(articles: CitableArticle[], order: CitationSortOrder): CitableArticle[] {
  return [...articles].sort(order === 'author' ? byAuthor : byYear);
}

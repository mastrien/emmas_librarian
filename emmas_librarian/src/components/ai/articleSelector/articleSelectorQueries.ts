import type { Article, SearchHistoryItem } from '../../../types';

export type SortOption = 'title-asc' | 'title-desc' | 'year-desc' | 'year-asc' | 'authors-asc' | 'search-id';

/** Which search the list is narrowed to: every one, a history id, or the articles that came from none. */
export type SearchFilter = number | 'all' | 'none';

/** One entry of the "which search" dropdown. */
export interface SearchFilterOption {
  id: number | 'none';
  label: string;
  count: number;
}

const queryPreview = (query: string): string => (query.length > 25 ? `${query.substring(0, 25)}...` : query);

/**
 * Whether the article matches the typed term, in its title, authors, year, journal (or publisher) or DOI.
 *
 * @example matchesTerm(article, 'radar') // true when "radar" is in any of them
 */
export function matchesTerm(article: Article, term: string): boolean {
  if (!term.trim()) return true;
  const q = term.toLowerCase();
  const fields = [article.title, article.authors, article.journal || article.publisher, article.doi];
  const year = article.year ? String(article.year) : '';
  return fields.some((f) => (f || '').toLowerCase().includes(q)) || year.includes(q);
}

/**
 * Whether the article came from the chosen search ('none': from no search, i.e. added or imported).
 *
 * @example matchesSearch({ search_id: 3 } as Article, 3) // true
 */
export function matchesSearch(article: Article, target: SearchFilter): boolean {
  if (target === 'all') return true;
  if (target === 'none') return !article.search_id;
  return article.search_id === target;
}

const COMPARE: Record<SortOption, (a: Article, b: Article) => number> = {
  'title-asc': (a, b) => a.title.localeCompare(b.title),
  'title-desc': (a, b) => b.title.localeCompare(a.title),
  'year-desc': (a, b) => (b.year || 0) - (a.year || 0),
  'year-asc': (a, b) => (a.year || 0) - (b.year || 0),
  'authors-asc': (a, b) => (a.authors || '').localeCompare(b.authors || ''),
  'search-id': (a, b) => (b.search_id || 0) - (a.search_id || 0),
};

/**
 * A sorted copy of the list.
 *
 * @example sortArticles(articles, 'year-desc')[0].year // the newest
 */
export function sortArticles(articles: Article[], sortBy: SortOption): Article[] {
  return [...articles].sort(COMPARE[sortBy]);
}

/**
 * The origin badge of an article: its search ("#3: machine learning OR ar..."), or "Manual / Importação".
 *
 * @example searchBadgeLabel(undefined, history) // 'Manual / Importação'
 */
export function searchBadgeLabel(searchId: number | undefined, history: SearchHistoryItem[]): string {
  if (!searchId) return 'Manual / Importação';
  const found = history.find((h) => h.id === searchId);
  return found ? `#${searchId}: ${queryPreview(found.unified_query)}` : `Busca #${searchId}`;
}

/**
 * The dropdown's entries: every search of the history, any search the articles name that the history lacks, and
 * "Manual / Sem busca no histórico" when some articles came from none; each with how many articles it has.
 *
 * @example searchFilterOptions(articles, history)[0] // { id: 3, label: '#3: radar', count: 12 }
 */
export function searchFilterOptions(articles: Article[], history: SearchHistoryItem[]): SearchFilterOption[] {
  const countOf = (id: number) => articles.filter((a) => a.search_id === id).length;
  const options: SearchFilterOption[] = history.map((h) => ({
    id: h.id,
    label: `#${h.id}: ${queryPreview(h.unified_query)}`,
    count: countOf(h.id),
  }));
  const known = new Set(history.map((h) => h.id));
  for (const a of articles) {
    if (!a.search_id || known.has(a.search_id)) continue;
    known.add(a.search_id);
    options.push({ id: a.search_id, label: `Busca #${a.search_id}`, count: countOf(a.search_id) });
  }
  const manual = articles.filter((a) => !a.search_id).length;
  if (manual > 0) options.push({ id: 'none', label: 'Manual / Sem busca no histórico', count: manual });
  return options;
}

/**
 * The dropdown's value back as a filter.
 *
 * @example parseSearchFilter('12') // 12
 */
export function parseSearchFilter(value: string): SearchFilter {
  return value === 'all' || value === 'none' ? value : Number(value);
}

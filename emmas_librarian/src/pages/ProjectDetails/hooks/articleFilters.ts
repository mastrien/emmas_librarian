import type { Article } from '../../../types';
import { parseSourceDatabases } from '../../../utils/sourceDatabases';
import { publicationYear } from '../../../utils/publicationYears';

export type StatusFilter = 'new' | 'read' | 'archived' | 'all';

/** Everything that narrows the article list, except the order. */
export interface ArticleFilterCriteria {
  searchTerm: string;
  onlyWithPdf: boolean;
  /** The other side of "Com PDF", for finding what still lacks one (validation of epic #44). */
  onlyWithoutPdf: boolean;
  onlyOpenAccess: boolean;
  statusFilter: StatusFilter;
  databases: string[];
  docType: string;
  keyword: string;
  /** Publication year range (board 153); null on a side means no limit there. */
  yearFrom: number | null;
  yearTo: number | null;
  /** With a year range on, whether articles without a year stay in the list. */
  includeNoYear: boolean;
}

/** The key of one removable filter chip: a field, or "database:<name>" for one selected base. */
export type FilterKey = 'pdf' | 'noPdf' | 'oa' | 'docType' | 'keyword' | 'year' | `database:${string}`;

export interface ActiveFilter {
  key: FilterKey;
  label: string;
}

// The order and names of the status control above the list (board 153): "Ativos" are the articles still to read.
export const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Todos',
  new: 'Ativos',
  read: 'Lidos',
  archived: 'Arquivados',
};

// Author and index keywords are stored as semicolon-separated strings.
export function articleKeywords(article: Article): string[] {
  return [article.author_keywords, article.index_keywords].flatMap((field) =>
    (field ?? '')
      .split(';')
      .map((k) => k.trim())
      .filter(Boolean),
  );
}

// Articles saved before the status column existed have no status and count as not read.
function matchesStatus(article: Article, status: StatusFilter): boolean {
  if (status === 'all') return true;
  if (status === 'new') return article.status === 'new' || !article.status;
  return article.status === status;
}

function matchesYear(article: Article, c: ArticleFilterCriteria): boolean {
  if (c.yearFrom === null && c.yearTo === null) return true;
  const year = publicationYear(article);
  if (year === null) return c.includeNoYear;
  return (c.yearFrom === null || year >= c.yearFrom) && (c.yearTo === null || year <= c.yearTo);
}

function matchesText(article: Article, term: string): boolean {
  const q = term.toLowerCase();
  return (article.title || '').toLowerCase().includes(q) || (article.authors || '').toLowerCase().includes(q);
}

/**
 * Whether an article passes every filter. The list, and the count shown next to each filter option,
 * both use this, so a count always matches what choosing that option shows.
 *
 * @example articles.filter((a) => matchesFilters(a, criteria))
 */
export function matchesFilters(article: Article, c: ArticleFilterCriteria): boolean {
  const keyword = c.keyword.toLowerCase();
  return (
    matchesText(article, c.searchTerm) &&
    (!c.onlyWithPdf || !!article.local_file_path) &&
    (!c.onlyWithoutPdf || !article.local_file_path) &&
    (!c.onlyOpenAccess || article.is_oa === 1) &&
    matchesStatus(article, c.statusFilter) &&
    (c.databases.length === 0 ||
      c.databases.some((db) => parseSourceDatabases(article.source_databases).includes(db))) &&
    (!c.docType || article.document_type === c.docType) &&
    (!keyword || articleKeywords(article).some((k) => k.toLowerCase() === keyword)) &&
    matchesYear(article, c)
  );
}

/**
 * How many articles would remain with `patch` applied on top of the current filters.
 *
 * @example countWith(articles, criteria, { databases: ['Scopus'] }) // 4
 */
export function countWith(
  articles: Article[],
  criteria: ArticleFilterCriteria,
  patch: Partial<ArticleFilterCriteria>,
): number {
  const next = { ...criteria, ...patch };
  return articles.filter((a) => matchesFilters(a, next)).length;
}

/** "2005–2026", "até 2010" or "desde 2005" for the year chip. */
function yearRangeLabel(c: ArticleFilterCriteria): string {
  if (c.yearFrom !== null && c.yearTo !== null) return `${c.yearFrom}–${c.yearTo}`;
  return c.yearFrom !== null ? `desde ${c.yearFrom}` : `até ${c.yearTo}`;
}

/**
 * The filters currently narrowing the list, as chips. The search box and the status are not chips: both have
 * their own control above the list (board 153).
 *
 * @example activeFilters({ ...criteria, onlyWithPdf: true }) // [{ key: 'pdf', label: 'Com PDF' }]
 */
export function activeFilters(
  c: ArticleFilterCriteria,
  docTypeLabel: (type: string) => string = (t) => t,
): ActiveFilter[] {
  const filters: ActiveFilter[] = [];
  if (c.onlyWithPdf) filters.push({ key: 'pdf', label: 'Com PDF' });
  if (c.onlyWithoutPdf) filters.push({ key: 'noPdf', label: 'Sem PDF' });
  if (c.onlyOpenAccess) filters.push({ key: 'oa', label: 'Acesso aberto' });
  c.databases.forEach((db) => filters.push({ key: `database:${db}`, label: db }));
  if (c.docType) filters.push({ key: 'docType', label: docTypeLabel(c.docType) });
  if (c.keyword) filters.push({ key: 'keyword', label: `"${c.keyword}"` });
  if (c.yearFrom !== null || c.yearTo !== null) filters.push({ key: 'year', label: yearRangeLabel(c) });
  return filters;
}

/**
 * The criteria with one chip's filter removed.
 *
 * @example withoutFilter(criteria, 'database:Scopus')
 */
export function withoutFilter(c: ArticleFilterCriteria, key: FilterKey): ArticleFilterCriteria {
  if (key === 'year') return { ...c, yearFrom: null, yearTo: null, includeNoYear: false };
  if (key === 'pdf') return { ...c, onlyWithPdf: false };
  if (key === 'noPdf') return { ...c, onlyWithoutPdf: false };
  if (key === 'oa') return { ...c, onlyOpenAccess: false };
  if (key === 'docType') return { ...c, docType: '' };
  if (key === 'keyword') return { ...c, keyword: '' };
  const db = key.slice('database:'.length);
  return { ...c, databases: c.databases.filter((d) => d !== db) };
}

/** All filters off. The search text and the status keep their values: they are not in the filters popover. */
export function clearedFilters(c: ArticleFilterCriteria): ArticleFilterCriteria {
  return {
    ...c,
    onlyWithPdf: false,
    onlyWithoutPdf: false,
    onlyOpenAccess: false,
    databases: [],
    docType: '',
    keyword: '',
    yearFrom: null,
    yearTo: null,
    includeNoYear: false,
  };
}

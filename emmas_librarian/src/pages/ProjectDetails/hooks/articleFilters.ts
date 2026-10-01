import type { Article } from '../../../types';
import { parseSourceDatabases } from '../../../utils/sourceDatabases';

export type StatusFilter = 'new' | 'read' | 'archived' | 'all';

/** Everything that narrows the article list, except the order. */
export interface ArticleFilterCriteria {
  searchTerm: string;
  onlyWithPdf: boolean;
  onlyOpenAccess: boolean;
  statusFilter: StatusFilter;
  databases: string[];
  docType: string;
  keyword: string;
}

/** The key of one removable filter chip: a field, or "database:<name>" for one selected base. */
export type FilterKey = 'status' | 'pdf' | 'oa' | 'docType' | 'keyword' | `database:${string}`;

export interface ActiveFilter {
  key: FilterKey;
  label: string;
}

export const STATUS_LABELS: Record<StatusFilter, string> = {
  new: 'Não lidos',
  read: 'Lidos',
  archived: 'Arquivados',
  all: 'Todos',
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
    (!c.onlyOpenAccess || article.is_oa === 1) &&
    matchesStatus(article, c.statusFilter) &&
    (c.databases.length === 0 ||
      c.databases.some((db) => parseSourceDatabases(article.source_databases).includes(db))) &&
    (!c.docType || article.document_type === c.docType) &&
    (!keyword || articleKeywords(article).some((k) => k.toLowerCase() === keyword))
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

/**
 * The filters currently narrowing the list, as chips. The search box and the default status
 * ("Não lidos") are not chips: the search has its own field and the default is not a choice.
 *
 * @example activeFilters({ ...criteria, onlyWithPdf: true }) // [{ key: 'pdf', label: 'Com PDF' }]
 */
export function activeFilters(
  c: ArticleFilterCriteria,
  docTypeLabel: (type: string) => string = (t) => t,
): ActiveFilter[] {
  const filters: ActiveFilter[] = [];
  if (c.statusFilter !== 'new') filters.push({ key: 'status', label: STATUS_LABELS[c.statusFilter] });
  if (c.onlyWithPdf) filters.push({ key: 'pdf', label: 'Com PDF' });
  if (c.onlyOpenAccess) filters.push({ key: 'oa', label: 'Acesso aberto' });
  c.databases.forEach((db) => filters.push({ key: `database:${db}`, label: db }));
  if (c.docType) filters.push({ key: 'docType', label: docTypeLabel(c.docType) });
  if (c.keyword) filters.push({ key: 'keyword', label: `"${c.keyword}"` });
  return filters;
}

/**
 * The criteria with one chip's filter removed.
 *
 * @example withoutFilter(criteria, 'database:Scopus')
 */
export function withoutFilter(c: ArticleFilterCriteria, key: FilterKey): ArticleFilterCriteria {
  if (key === 'status') return { ...c, statusFilter: 'new' };
  if (key === 'pdf') return { ...c, onlyWithPdf: false };
  if (key === 'oa') return { ...c, onlyOpenAccess: false };
  if (key === 'docType') return { ...c, docType: '' };
  if (key === 'keyword') return { ...c, keyword: '' };
  const db = key.slice('database:'.length);
  return { ...c, databases: c.databases.filter((d) => d !== db) };
}

/** All filters off (the search box keeps its text; it is not part of "Limpar filtros"). */
export function clearedFilters(c: ArticleFilterCriteria): ArticleFilterCriteria {
  return {
    ...c,
    onlyWithPdf: false,
    onlyOpenAccess: false,
    statusFilter: 'new',
    databases: [],
    docType: '',
    keyword: '',
  };
}

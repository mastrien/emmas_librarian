import type { NormalizedArticle } from '../types';
import { SEARCH_LIMITS } from '../../../src/utils/searchLimits';
import { collectPages, rateLimited, type Page, type PagedResult } from './paginate';
import { logAndRethrow, openAccessFlag, type SortBy } from './shared';

const SCOPUS_URL = 'https://api.elsevier.com/content/search/scopus';
// 200 per request in the STANDARD view; the `start` offset reaches 5,000 results in total.
const PAGE_SIZE = 200;

/** The fields of a Scopus search entry that the app reads. */
export interface ScopusEntry {
  'prism:doi'?: string;
  'dc:title'?: string;
  'dc:creator'?: string;
  'dc:identifier'?: string;
  'prism:coverDate'?: string;
  'dc:description'?: string;
  authkeywords?: string;
  'prism:publicationName'?: string;
  'prism:volume'?: string;
  'prism:issueIdentifier'?: string;
  'prism:pageRange'?: string;
  subtypeDescription?: string;
  'prism:aggregationType'?: string;
  'citedby-count'?: string | number | null;
  'prism:issn'?: string;
  openaccess?: unknown;
}

const SORT_PARAM: Record<SortBy, string> = { citations: 'citedby-count', date: 'pubyear', relevance: 'relevancy' };

/**
 * Searches Scopus with a translated query, page by page (offset) up to `limit` (never more than
 * SEARCH_LIMITS.scopus.max); without an API key it returns nothing.
 *
 * Usage:
 *   const { articles } = await searchScopus('TITLE-ABS-KEY("machine learning")', apiKey, 'relevance', 400);
 */
export async function searchScopus(
  queryStr: string,
  apiKey: string,
  sortBy: SortBy,
  limit: number = 50,
): Promise<PagedResult> {
  if (!apiKey) return { articles: [] };
  return logAndRethrow('Scopus', () =>
    collectPages({
      baseName: 'Scopus',
      limit: Math.min(limit, SEARCH_LIMITS.scopus.max),
      pageSize: PAGE_SIZE,
      firstCursor: 0,
      fetchPage: (start, size) => fetchScopusPage({ queryStr, apiKey, sortBy }, Number(start), size),
    }),
  );
}

interface ScopusQuery {
  queryStr: string;
  apiKey: string;
  sortBy: SortBy;
}

async function fetchScopusPage(query: ScopusQuery, start: number, size: number): Promise<Page> {
  const response = await fetch(scopusUrl(query, start, size), {
    headers: { 'X-ELS-APIKey': query.apiKey, Accept: 'application/json' },
  });
  if (response.ok) {
    const results = (await response.json())['search-results'];
    const total = Number(results?.['opensearch:totalResults'] ?? Infinity);
    const entries = (results?.entry || []) as ScopusEntry[];
    return { articles: entries.map(normalizeScopus), next: start + size < total ? start + size : null };
  }
  if (response.status === 401) throw new Error('Chave de API inválida ou expirada');
  if (response.status === 429) throw rateLimited('Scopus', response);
  const errorData = await response.json().catch(() => ({}));
  throw new Error(errorData['service-error']?.status?.statusText || `Erro ${response.status} no Scopus`);
}

function scopusUrl({ queryStr, sortBy }: ScopusQuery, start: number, size: number): string {
  const url = new URL(SCOPUS_URL);
  url.searchParams.append('query', queryStr);
  url.searchParams.append('count', String(size));
  url.searchParams.append('start', String(start));
  url.searchParams.append('sort', SORT_PARAM[sortBy] ?? SORT_PARAM.relevance);
  return url.toString();
}

/**
 * Maps a Scopus entry to the app's article shape (Scopus gives only the first author, in dc:creator).
 *
 * Usage:
 *   normalizeScopus({ 'dc:title': 'T', 'prism:coverDate': '2026-06-03' }).year; // 2026
 */
export function normalizeScopus(raw: ScopusEntry): NormalizedArticle {
  const doi = raw['prism:doi'] || '';
  const title = raw['dc:title'] || '';
  const authors = raw['dc:creator'] || '';
  const date = raw['prism:coverDate'] || '';
  const year = date ? parseInt(date.split('-')[0]) : undefined;
  const citedBy = raw['citedby-count'];
  const isOa = openAccessFlag(raw.openaccess);
  return {
    doi,
    title,
    authors,
    year,
    abstract: raw['dc:description'] || undefined,
    authorKeywords: raw.authkeywords || undefined,
    journal: raw['prism:publicationName'] || undefined,
    volume: raw['prism:volume'] || undefined,
    issue: raw['prism:issueIdentifier'] || undefined,
    pages: raw['prism:pageRange'] || undefined,
    documentType: raw.subtypeDescription || raw['prism:aggregationType'] || undefined,
    citationCount: citedBy != null ? parseInt(String(citedBy), 10) : undefined,
    issn: raw['prism:issn'] || undefined,
    source_databases: ['Scopus'],
    csl_json: {
      id: doi || raw['dc:identifier'],
      type: 'article-journal',
      title,
      DOI: doi,
      issued: year ? { 'date-parts': [[year]] } : undefined,
      author: [{ family: authors }],
      is_oa: isOa,
      publisher: undefined,
    },
    is_oa: isOa,
    publisher: undefined,
  };
}

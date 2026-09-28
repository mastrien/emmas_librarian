import type { NormalizedArticle } from '../types';
import { logAndRethrow, openAccessFlag, type SortBy } from './shared';

const SCOPUS_URL = 'https://api.elsevier.com/content/search/scopus';

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
 * Searches Scopus with a translated query; without an API key it returns nothing.
 *
 * Usage:
 *   await searchScopus('TITLE-ABS-KEY("machine learning")', apiKey, 'relevance', 50);
 */
export async function searchScopus(
  queryStr: string,
  apiKey: string,
  sortBy: SortBy,
  limit: number = 50,
): Promise<NormalizedArticle[]> {
  if (!apiKey) return [];
  return logAndRethrow('Scopus', async () => {
    const response = await fetch(scopusUrl(queryStr, sortBy, limit), {
      headers: { 'X-ELS-APIKey': apiKey, Accept: 'application/json' },
    });
    if (response.ok) {
      const data = await response.json();
      return ((data['search-results']?.entry || []) as ScopusEntry[]).map(normalizeScopus);
    }
    if (response.status === 401) throw new Error('Chave de API inválida ou expirada');
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData['service-error']?.status?.statusText || `Erro ${response.status} no Scopus`);
  });
}

function scopusUrl(queryStr: string, sortBy: SortBy, limit: number): string {
  const url = new URL(SCOPUS_URL);
  url.searchParams.append('query', queryStr);
  url.searchParams.append('count', String(Math.min(limit, 200))); // Scopus max per request is 200
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

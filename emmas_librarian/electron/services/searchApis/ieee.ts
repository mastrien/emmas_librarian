import type { NormalizedArticle } from '../types';
import { SEARCH_LIMITS } from '../../../src/utils/searchLimits';
import { collectPages, rateLimited, withNote, type Page, type PagedResult } from './paginate';
import { logAndRethrow, type SortBy } from './shared';

const IEEE_URL = 'https://ieeexploreapi.ieee.org/api/v1/search/articles';

/** The fields of an IEEE Xplore Metadata API article that the app reads. */
export interface IeeeArticle {
  article_number?: string | number;
  doi?: string;
  title?: string;
  authors?: { authors?: { full_name?: string; affiliation?: string }[] };
  abstract?: string;
  publication_year?: number | string;
  publication_title?: string;
  volume?: string;
  issue?: string;
  start_page?: string;
  end_page?: string;
  issn?: string;
  publisher?: string;
  content_type?: string;
  access_type?: string;
  citing_paper_count?: number;
  index_terms?: { author_terms?: { terms?: string[] }; ieee_terms?: { terms?: string[] } };
  html_url?: string;
}

// The API sorts only by article number, title or publication title: date and citation order are not
// available, so the base keeps its own order and the history says so.
const SORT_NOTE: Record<SortBy, string | undefined> = {
  relevance: undefined,
  date: 'A API da IEEE Xplore não ordena por data; os resultados vieram na ordem padrão da base.',
  citations: 'A API da IEEE Xplore não ordena por citações; os resultados vieram na ordem padrão da base.',
};

/**
 * Searches IEEE Xplore (Metadata Search API) page by page, 200 at a time, up to `limit` (never more than
 * SEARCH_LIMITS.ieee.max); without an API key it returns nothing.
 *
 * Usage:
 *   const { articles, warning } = await searchIeee('("Document Title":"smart grid")', apiKey, 'relevance', 400);
 */
export async function searchIeee(
  query: string,
  apiKey: string,
  sortBy: SortBy,
  limit: number = 50,
  sleep?: (ms: number) => Promise<void>,
): Promise<PagedResult> {
  if (!apiKey) return { articles: [], requests: 0 };
  const result = await logAndRethrow('IEEE Xplore', () =>
    collectPages({
      baseName: 'IEEE Xplore',
      limit: Math.min(limit, SEARCH_LIMITS.ieee.max),
      pageSize: SEARCH_LIMITS.ieee.pageSize,
      firstCursor: 1,
      fetchPage: (start, size) => fetchIeeePage(query, apiKey, Number(start), size),
      delayMs: SEARCH_LIMITS.ieee.pageIntervalMs,
      sleep,
    }),
  );
  return withNote(result, SORT_NOTE[sortBy]);
}

async function fetchIeeePage(query: string, apiKey: string, start: number, size: number): Promise<Page> {
  const response = await fetch(ieeeUrl(query, apiKey, start, size));
  if (response.ok) {
    const data = await response.json();
    const total = data.total_records === undefined ? undefined : Number(data.total_records);
    // start_record counts from 1.
    const next = total === undefined || start - 1 + size < total ? start + size : null;
    return { articles: ((data.articles ?? []) as IeeeArticle[]).map(normalizeIeee), next, total };
  }
  if (response.status === 429) throw rateLimited('IEEE Xplore', response);
  if (response.status === 401 || response.status === 403) throw ieeeAccessError(response);
  throw new Error(`Erro ${response.status} na IEEE Xplore`);
}

// IEEE's gateway answers 403 for a bad key and for exhausted quotas; its detail header tells them apart.
function ieeeAccessError(response: Response): Error {
  const detail = response.headers?.get('X-Error-Detail-Header') ?? '';
  if (/per day/i.test(detail)) return new Error('Cota diária da API da IEEE Xplore atingida. Tente de novo amanhã.');
  if (/rate/i.test(detail)) return rateLimited('IEEE Xplore', response);
  return new Error('Chave de API inválida ou expirada');
}

function ieeeUrl(query: string, apiKey: string, start: number, size: number): string {
  const url = new URL(IEEE_URL);
  url.searchParams.append('querytext', query);
  url.searchParams.append('format', 'json');
  url.searchParams.append('max_records', String(size));
  url.searchParams.append('start_record', String(start));
  url.searchParams.append('apikey', apiKey);
  return url.toString();
}

const joined = (terms: string[] | undefined) => (terms?.length ? terms.join('; ') : undefined);

function pagesOf(raw: IeeeArticle): string | undefined {
  if (!raw.start_page) return undefined;
  return raw.end_page && raw.end_page !== raw.start_page ? `${raw.start_page}-${raw.end_page}` : raw.start_page;
}

/**
 * Maps an IEEE Xplore article to the app's article shape (IEEE index terms as index keywords).
 *
 * Usage:
 *   normalizeIeee({ title: 'T', access_type: 'OPEN_ACCESS' }).is_oa; // 1
 */
export function normalizeIeee(raw: IeeeArticle): NormalizedArticle {
  const people = raw.authors?.authors ?? [];
  const authors = people.map((a) => a.full_name).filter((n): n is string => !!n);
  const affiliations = [...new Set(people.map((a) => a.affiliation).filter(Boolean))].join('; ');
  const year = raw.publication_year ? Number(raw.publication_year) : undefined;
  const isOa = raw.access_type ? (raw.access_type === 'OPEN_ACCESS' ? 1 : 0) : undefined;
  return {
    doi: raw.doi || '',
    title: raw.title || '',
    authors: authors.join(', '),
    year,
    abstract: raw.abstract || undefined,
    authorKeywords: joined(raw.index_terms?.author_terms?.terms),
    indexKeywords: joined(raw.index_terms?.ieee_terms?.terms),
    journal: raw.publication_title,
    volume: raw.volume,
    issue: raw.issue,
    pages: pagesOf(raw),
    affiliations: affiliations || undefined,
    documentType: raw.content_type,
    issn: raw.issn,
    citationCount: raw.citing_paper_count,
    source_databases: ['IEEE Xplore'],
    csl_json: {
      id: raw.article_number ? `ieee:${raw.article_number}` : raw.doi,
      type: raw.content_type === 'Conferences' ? 'paper-conference' : 'article-journal',
      title: raw.title,
      DOI: raw.doi,
      URL: raw.html_url,
      issued: year ? { 'date-parts': [[year]] } : undefined,
      author: authors.map((name) => ({ literal: name })),
      is_oa: isOa,
      publisher: raw.publisher,
    },
    is_oa: isOa,
    publisher: raw.publisher,
  };
}

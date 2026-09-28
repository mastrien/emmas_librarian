import type { NormalizedArticle } from '../types';
import { SEARCH_LIMITS } from '../../../src/utils/searchLimits';
import { collectPages, rateLimited, type Page, type PagedResult } from './paginate';
import { logAndRethrow, type SortBy } from './shared';

const WOS_URL = 'https://api.clarivate.com/apis/wos-starter/v1/documents';
// The Starter API serves 50 per page; the free trial allows 1 request per second (and 50 per day).
const PAGE_SIZE = 50;
const PAGE_INTERVAL_MS = 1100;

/** The fields of a Web of Science Starter hit that the app reads. */
export interface WosHit {
  uid?: string;
  title?: string;
  identifiers?: { doi?: string };
  names?: { authors?: { displayName?: string }[] };
  publication?: { year?: number };
  other?: { abstract?: string };
  abstract?: string;
  keywords?: { authorKeywords?: string[] };
  source?: {
    sourceTitle?: string;
    volume?: string;
    issue?: string;
    pages?: { range?: string };
    documentType?: string;
  };
  doctype?: string;
  citations?: { length?: number };
  citationCount?: number;
}

// Starter API sorting is Field+Direction.
const SORT_PARAM: Record<SortBy, string> = { citations: 'TC+D', date: 'PY+D', relevance: 'RS+D' };

/**
 * Searches the Web of Science Starter API page by page, about one request per second, up to `limit`
 * (never more than SEARCH_LIMITS.wos.max); without an API key it returns nothing.
 *
 * Usage:
 *   const { articles } = await searchWoS('TS=("machine learning")', apiKey, 'citations', 150);
 */
export async function searchWoS(
  queryStr: string,
  apiKey: string,
  sortBy: SortBy,
  limit: number = 50,
  sleep?: (ms: number) => Promise<void>,
): Promise<PagedResult> {
  if (!apiKey) return { articles: [] };
  return logAndRethrow('WoS', () =>
    collectPages({
      baseName: 'Web of Science',
      limit: Math.min(limit, SEARCH_LIMITS.wos.max),
      pageSize: PAGE_SIZE,
      firstCursor: 1,
      fetchPage: (page, size) => fetchWosPage({ queryStr, apiKey, sortBy }, Number(page), size),
      delayMs: PAGE_INTERVAL_MS,
      sleep,
    }),
  );
}

interface WosQuery {
  queryStr: string;
  apiKey: string;
  sortBy: SortBy;
}

async function fetchWosPage(query: WosQuery, page: number, size: number): Promise<Page> {
  const response = await fetch(wosUrl(query, page, size), {
    headers: { 'X-ApiKey': query.apiKey, Accept: 'application/json' },
  });
  if (response.ok) {
    const data = await response.json();
    const total = Number(data.metadata?.total ?? Infinity);
    return { articles: ((data.hits || []) as WosHit[]).map(normalizeWoS), next: page * size < total ? page + 1 : null };
  }
  if (response.status === 401) throw new Error('Chave de API inválida ou expirada');
  if (response.status === 429) throw rateLimited('Web of Science', response);
  throw new Error(wosErrorMessage(response.status, await response.text().catch(() => '')));
}

function wosUrl({ queryStr, sortBy }: WosQuery, page: number, size: number): string {
  const url = new URL(WOS_URL);
  url.searchParams.append('db', 'WOS');
  url.searchParams.append('q', queryStr);
  url.searchParams.append('limit', String(size));
  url.searchParams.append('page', String(page));
  url.searchParams.append('sortField', SORT_PARAM[sortBy] ?? SORT_PARAM.relevance);
  return url.toString();
}

type WosErrorField = string | { message?: string; error?: { message?: string } | string } | undefined;

// WoS nests its error text in several shapes; take the most specific readable message.
function describeWosField(raw: WosErrorField): string {
  if (typeof raw !== 'object') return String(raw);
  if (raw.message) return String(raw.message);
  if (raw.error && typeof raw.error === 'object' && raw.error.message) return String(raw.error.message);
  return JSON.stringify(raw);
}

/**
 * The message shown for a failed WoS request: the API's own error text when the body is JSON,
 * the raw body otherwise.
 *
 * Usage:
 *   wosErrorMessage(400, '{"message":"Unknown field"}'); // 'Unknown field'
 */
export function wosErrorMessage(status: number, responseText: string): string {
  const fallback = `Erro ${status} no Web of Science`;
  try {
    const errorData = JSON.parse(responseText);
    const rawMessage: WosErrorField =
      errorData.message || errorData.error || errorData.description || errorData.details;
    let message = rawMessage ? describeWosField(rawMessage) : fallback;
    if (errorData.details && typeof errorData.details === 'object' && errorData.details !== rawMessage) {
      message += `: ${JSON.stringify(errorData.details)}`;
    }
    return message;
  } catch {
    return responseText ? `${fallback} - ${responseText}` : fallback;
  }
}

/**
 * Maps a WoS Starter hit to the app's article shape (WoS never says whether it is open access).
 *
 * Usage:
 *   normalizeWoS({ uid: 'WOS:1', title: 'T' }).source_databases; // ['Web of Science']
 */
export function normalizeWoS(raw: WosHit): NormalizedArticle {
  const doi = raw.identifiers?.doi || '';
  const title = raw.title || '';
  const authorNames = (raw.names?.authors || []).map((a) => a.displayName);
  const year = raw.publication?.year;
  return {
    doi,
    title,
    authors: authorNames.join(', '),
    year,
    abstract: raw.other?.abstract || raw.abstract || undefined,
    authorKeywords: raw.keywords?.authorKeywords?.length ? raw.keywords.authorKeywords.join('; ') : undefined,
    journal: raw.source?.sourceTitle || undefined,
    volume: raw.source?.volume || undefined,
    issue: raw.source?.issue || undefined,
    pages: raw.source?.pages?.range || undefined,
    documentType: raw.doctype || raw.source?.documentType || undefined,
    citationCount: raw.citations?.length ?? raw.citationCount ?? undefined,
    source_databases: ['Web of Science'],
    csl_json: {
      id: doi || raw.uid,
      type: 'article-journal',
      title,
      DOI: doi,
      issued: year ? { 'date-parts': [[year]] } : undefined,
      author: authorNames.map((name) => ({ family: name })),
      is_oa: undefined,
      publisher: undefined,
    },
    is_oa: undefined,
    publisher: undefined,
  };
}

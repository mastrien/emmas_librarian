import type { NormalizedArticle } from '../types';
import { logAndRethrow, type SortBy } from './shared';

const WOS_URL = 'https://api.clarivate.com/apis/wos-starter/v1/documents';

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
 * Searches the Web of Science Starter API; without an API key it returns nothing.
 *
 * Usage:
 *   await searchWoS('TS=("machine learning")', apiKey, 'citations', 50);
 */
export async function searchWoS(
  queryStr: string,
  apiKey: string,
  sortBy: SortBy,
  limit: number = 50,
): Promise<NormalizedArticle[]> {
  if (!apiKey) return [];
  return logAndRethrow('WoS', async () => {
    const response = await fetch(wosUrl(queryStr, sortBy, limit), {
      headers: { 'X-ApiKey': apiKey, Accept: 'application/json' },
    });
    if (response.ok) {
      const data = await response.json();
      return ((data.hits || []) as WosHit[]).map(normalizeWoS);
    }
    if (response.status === 401) throw new Error('Chave de API inválida ou expirada');
    throw new Error(wosErrorMessage(response.status, await response.text().catch(() => '')));
  });
}

function wosUrl(queryStr: string, sortBy: SortBy, limit: number): string {
  const url = new URL(WOS_URL);
  url.searchParams.append('db', 'WOS');
  url.searchParams.append('q', queryStr);
  url.searchParams.append('limit', String(Math.min(limit, 50)));
  url.searchParams.append('page', '1');
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

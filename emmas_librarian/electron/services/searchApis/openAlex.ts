import type { NormalizedArticle } from '../types';
import { SEARCH_LIMITS } from '../../../src/utils/searchLimits';
import { collectPages, rateLimited, type Page, type PageCursor, type PagedResult } from './paginate';
import { logAndRethrow, openAccessFlag, type SortBy } from './shared';

const OPENALEX_URL = 'https://api.openalex.org/works';
// per_page=100 is the documented maximum; 200 still works but is deprecated and "will be removed".
const PAGE_SIZE = 100;

/** The fields of an OpenAlex work that the app reads. */
export interface OpenAlexWork {
  id?: string;
  doi?: string;
  title?: string;
  publication_year?: number;
  authorships?: { author?: { display_name?: string } | null; institutions?: { display_name?: string }[] }[];
  abstract_inverted_index?: Record<string, number[]>;
  keywords?: ({ display_name?: string; keyword?: string } | string)[];
  concepts?: { display_name?: string }[];
  primary_location?: {
    source?: { display_name?: string; issn_l?: string; host_organization_name?: string; publisher?: string };
  };
  biblio?: { volume?: string; issue?: string; first_page?: string; last_page?: string };
  referenced_works?: string[];
  type?: string;
  type_crossref?: string;
  cited_by_count?: number;
  open_access?: { is_oa?: unknown };
}

const SORT_PARAM: Record<SortBy, string> = {
  citations: 'cited_by_count:desc',
  date: 'publication_date:desc',
  relevance: 'relevance_score:desc',
};

/**
 * Searches OpenAlex with a translated filter, following its cursor page by page up to `limit`
 * (never more than SEARCH_LIMITS.openalex.max). The optional free API key raises the daily budget 10x.
 *
 * Usage:
 *   const { articles, warning } = await searchOpenAlex('title_and_abstract.search:"machine learning"', 'relevance', 300);
 */
export function searchOpenAlex(
  filterStr: string,
  sortBy: SortBy,
  limit: number = 50,
  apiKey: string = '',
): Promise<PagedResult> {
  return logAndRethrow('OpenAlex', () =>
    collectPages({
      baseName: 'OpenAlex',
      limit: Math.min(limit, SEARCH_LIMITS.openalex.max),
      pageSize: PAGE_SIZE,
      firstCursor: '*',
      fetchPage: (cursor, size) => fetchOpenAlexPage({ filterStr, sortBy, apiKey }, cursor, size),
    }),
  );
}

interface OpenAlexQuery {
  filterStr: string;
  sortBy: SortBy;
  apiKey: string;
}

// The key goes as a bearer token (OpenAlex also accepts ?api_key=) so it stays out of URLs and logs.
async function fetchOpenAlexPage(query: OpenAlexQuery, cursor: PageCursor, size: number): Promise<Page> {
  const init = query.apiKey ? { headers: { Authorization: `Bearer ${query.apiKey}` } } : undefined;
  const response = await fetch(openAlexUrl(query, cursor, size), init);
  if (response.ok) {
    const data = await response.json();
    const works = (data.results || []) as OpenAlexWork[];
    return { articles: works.map(normalizeOpenAlex), next: data.meta?.next_cursor ?? null, total: data.meta?.count };
  }
  if (response.status === 429) throw rateLimited('OpenAlex', response);
  const errorData = await response.json().catch(() => ({}));
  throw new Error(errorData.message || `Erro ${response.status} no OpenAlex`);
}

function openAlexUrl({ filterStr, sortBy }: OpenAlexQuery, cursor: PageCursor, size: number): string {
  const url = new URL(OPENALEX_URL);
  // The translator may hand over "filter=..."; OpenAlex wants just the value.
  const cleanFilter = filterStr.includes('filter=') ? filterStr.split('filter=').pop()! : filterStr;
  if (cleanFilter) url.searchParams.append('filter', cleanFilter);
  url.searchParams.append('per_page', String(size));
  url.searchParams.append('sort', SORT_PARAM[sortBy] ?? SORT_PARAM.relevance);
  url.searchParams.append('cursor', String(cursor));
  return url.toString();
}

function splitName(name: string): { given?: string; family: string } {
  const parts = name.split(' ');
  return parts.length > 1 ? { given: parts.slice(0, -1).join(' '), family: parts[parts.length - 1] } : { family: name };
}

// OpenAlex stores abstracts as word → positions; rebuild the text in position order.
function abstractFrom(index: Record<string, number[]> | undefined): string | undefined {
  if (!index) return undefined;
  const pairs: [string, number][] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) pairs.push([word, pos]);
  }
  return pairs
    .sort((a, b) => a[1] - b[1])
    .map((p) => p[0])
    .join(' ');
}

function institutionsOf(raw: OpenAlexWork): string | undefined {
  const names: string[] = [];
  for (const auth of raw.authorships || []) {
    for (const inst of auth.institutions || []) {
      if (inst.display_name && !names.includes(inst.display_name)) names.push(inst.display_name);
    }
  }
  return names.length ? names.join('; ') : undefined;
}

function pagesOf(biblio: OpenAlexWork['biblio']): string | undefined {
  const first = biblio?.first_page;
  if (!first) return undefined;
  return biblio?.last_page ? `${first}-${biblio.last_page}` : first;
}

const keywordText = (k: { display_name?: string; keyword?: string } | string) =>
  typeof k === 'string' ? k : k.display_name || k.keyword || k;

/**
 * Maps an OpenAlex work to the app's article shape.
 *
 * Usage:
 *   normalizeOpenAlex({ title: 'T', doi: 'https://doi.org/10.1/x' }).doi; // '10.1/x'
 */
export function normalizeOpenAlex(raw: OpenAlexWork): NormalizedArticle {
  const doi = raw.doi && raw.doi.includes('doi.org/') ? raw.doi.split('doi.org/').pop() || raw.doi : raw.doi || '';
  const authors = (raw.authorships || [])
    .map((a) => a.author?.display_name || '')
    .filter(Boolean)
    .map(splitName);
  const year = raw.publication_year;
  const source = raw.primary_location?.source;
  const isOa = openAccessFlag(raw.open_access?.is_oa);
  const publisher = source?.host_organization_name || source?.publisher || undefined;
  const cslJson = {
    id: raw.id,
    type: 'article-journal',
    title: raw.title,
    DOI: doi,
    issued: { 'date-parts': [[year]] },
    author: authors,
    is_oa: isOa,
    publisher,
  };
  return {
    doi,
    title: raw.title || '',
    authors: authors.map((a) => `${a.given || ''} ${a.family || ''}`.trim()).join(', '),
    year,
    abstract: abstractFrom(raw.abstract_inverted_index),
    authorKeywords: raw.keywords?.length ? raw.keywords.map(keywordText).join('; ') : undefined,
    indexKeywords: raw.concepts?.length ? raw.concepts.map((c) => c.display_name).join('; ') : undefined,
    journal: source?.display_name,
    volume: raw.biblio?.volume,
    issue: raw.biblio?.issue,
    pages: pagesOf(raw.biblio),
    affiliations: institutionsOf(raw),
    references: raw.referenced_works?.length ? raw.referenced_works.join('; ') : undefined,
    documentType: raw.type_crossref || raw.type,
    issn: source?.issn_l,
    citationCount: raw.cited_by_count,
    source_databases: ['OpenAlex'],
    csl_json: cslJson,
    is_oa: isOa,
    publisher,
  };
}

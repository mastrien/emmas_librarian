import type { NormalizedArticle } from '../types';
import { SEARCH_LIMITS } from '../../../src/utils/searchLimits';
import { collectPages, rateLimited, type Page, type PageCursor, type PagedResult } from './paginate';
import { logAndRethrow, type SortBy } from './shared';

const CROSSREF_URL = 'https://api.crossref.org/works';
// Crossref serves up to 1,000 rows per request; deeper results come through its cursor.
const PAGE_SIZE = 1000;

/** The fields of a Crossref work that the app reads. */
export interface CrossrefWork {
  DOI?: string;
  title?: string[];
  issued?: { 'date-parts'?: (number | undefined)[][] };
  author?: { given?: string; family?: string; affiliation?: { name?: string }[] }[];
  abstract?: string;
  subject?: string[];
  'container-title'?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  reference?: { DOI?: string; unstructured?: string }[];
  type?: string;
  ISSN?: string[];
  'is-referenced-by-count'?: number;
  publisher?: string;
}

/**
 * Searches Crossref with a translated query string ("query.bibliographic=...&filter=..."), following its
 * cursor up to `limit` (never more than SEARCH_LIMITS.crossref.max).
 *
 * Usage:
 *   const { articles } = await searchCrossref('query.bibliographic=machine+learning', 'date', 100);
 */
export function searchCrossref(queryStr: string, sortBy: SortBy, limit: number = 50): Promise<PagedResult> {
  return logAndRethrow('Crossref', () =>
    collectPages({
      baseName: 'Crossref',
      limit: Math.min(limit, SEARCH_LIMITS.crossref.max),
      pageSize: PAGE_SIZE,
      firstCursor: '*',
      fetchPage: (cursor, size) => fetchCrossrefPage(queryStr, sortBy, cursor, size),
    }),
  );
}

async function fetchCrossrefPage(queryStr: string, sortBy: SortBy, cursor: PageCursor, size: number): Promise<Page> {
  const response = await fetch(crossrefUrl(queryStr, sortBy, cursor, size));
  if (response.ok) {
    const data = await response.json();
    const items = (data.message?.items || []) as CrossrefWork[];
    return { articles: items.map(normalizeCrossref), next: data.message?.['next-cursor'] ?? null };
  }
  if (response.status === 429) throw rateLimited('Crossref', response);
  const errorData = await response.json().catch(() => ({}));
  throw new Error(errorData.message || `Erro ${response.status} no Crossref`);
}

function crossrefUrl(queryStr: string, sortBy: SortBy, cursor: PageCursor, size: number): string {
  const url = new URL(CROSSREF_URL);
  const params = new URLSearchParams(queryStr);
  params.set('rows', String(size));
  params.set('cursor', String(cursor));
  if (sortBy === 'citations') {
    params.set('sort', 'is-referenced-by-count');
    params.set('order', 'desc');
  } else if (sortBy === 'date') {
    params.set('sort', 'published');
    params.set('order', 'desc');
  } else if (!params.has('sort')) {
    params.set('sort', 'score');
  }
  url.search = params.toString();
  return url.toString();
}

function affiliationsOf(raw: CrossrefWork): string | undefined {
  const names: string[] = [];
  for (const author of raw.author || []) {
    for (const aff of author.affiliation || []) {
      if (aff.name && !names.includes(aff.name)) names.push(aff.name);
    }
  }
  return names.length ? names.join('; ') : undefined;
}

function referencesOf(raw: CrossrefWork): string | undefined {
  if (!raw.reference?.length) return undefined;
  return raw.reference
    .map((ref) => ref.DOI || ref.unstructured || '')
    .filter(Boolean)
    .join('; ');
}

/**
 * Maps a Crossref work to the app's article shape (abstract without JATS/HTML tags).
 *
 * Usage:
 *   normalizeCrossref({ DOI: '10.1/x', title: ['T'] }).title; // 'T'
 */
export function normalizeCrossref(raw: CrossrefWork): NormalizedArticle {
  const title = raw.title && raw.title.length > 0 ? raw.title[0] : '';
  const publisher = raw.publisher || undefined;
  return {
    doi: raw.DOI,
    title,
    authors: (raw.author || []).map((a) => `${a.given || ''} ${a.family || ''}`.trim()).join(', '),
    year: raw.issued?.['date-parts']?.[0]?.[0],
    abstract: raw.abstract ? raw.abstract.replace(/<[^>]*>/g, '').trim() : undefined,
    authorKeywords: raw.subject?.length ? raw.subject.join('; ') : undefined,
    journal: raw['container-title']?.[0],
    volume: raw.volume,
    issue: raw.issue,
    pages: raw.page,
    affiliations: affiliationsOf(raw),
    references: referencesOf(raw),
    documentType: raw.type,
    issn: raw.ISSN?.[0],
    citationCount: raw['is-referenced-by-count'],
    source_databases: ['Crossref'],
    csl_json: {
      id: raw.DOI,
      type: 'article-journal',
      title,
      DOI: raw.DOI,
      issued: raw.issued,
      author: raw.author || [],
      publisher,
    },
    publisher,
  };
}

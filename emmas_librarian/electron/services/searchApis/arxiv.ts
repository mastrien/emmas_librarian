import type { NormalizedArticle } from '../types';
import { SEARCH_LIMITS } from '../../../src/utils/searchLimits';
import { parseArxivFeed, type ArxivEntry } from './atomFeed';
import { collectPages, rateLimited, withNote, type Page, type PagedResult } from './paginate';
import { logAndRethrow, type SortBy } from './shared';

const ARXIV_URL = 'https://export.arxiv.org/api/query';

// arXiv has no citation counts, so "Mais citados" falls back to relevance and the history says so.
const SORT: Record<SortBy, { sortBy: string; note?: string }> = {
  relevance: { sortBy: 'relevance' },
  date: { sortBy: 'submittedDate' },
  citations: {
    sortBy: 'relevance',
    note: 'O arXiv não ordena por citações; os resultados vieram por relevância.',
  },
};

/**
 * Searches arXiv page by page (offset), one request every 3 s as its terms of use ask, up to `limit`
 * (never more than SEARCH_LIMITS.arxiv.max). No key is needed; every entry is open access.
 *
 * Usage:
 *   const { articles, warning } = await searchArxiv('(ti:machine AND ti:learning)', 'date', 500);
 */
export async function searchArxiv(
  query: string,
  sortBy: SortBy,
  limit: number = 50,
  sleep?: (ms: number) => Promise<void>,
): Promise<PagedResult> {
  const result = await logAndRethrow('arXiv', () =>
    collectPages({
      baseName: 'arXiv',
      limit: Math.min(limit, SEARCH_LIMITS.arxiv.max),
      pageSize: SEARCH_LIMITS.arxiv.pageSize,
      firstCursor: 0,
      fetchPage: (start, size) => fetchArxivPage(query, sortBy, Number(start), size),
      delayMs: SEARCH_LIMITS.arxiv.pageIntervalMs,
      sleep,
    }),
  );
  return withNote(result, SORT[sortBy].note);
}

async function fetchArxivPage(query: string, sortBy: SortBy, start: number, size: number): Promise<Page> {
  const response = await fetch(arxivUrl(query, sortBy, start, size));
  if (response.ok) {
    const { total, entries } = parseArxivFeed(await response.text());
    return { articles: entries.map(normalizeArxiv), next: start + size < total ? start + size : null, total };
  }
  // arXiv answers 503 when requests come too fast.
  if (response.status === 429 || response.status === 503) throw rateLimited('arXiv', response);
  throw new Error(`Erro ${response.status} no arXiv`);
}

function arxivUrl(query: string, sortBy: SortBy, start: number, size: number): string {
  const url = new URL(ARXIV_URL);
  url.searchParams.append('search_query', query);
  url.searchParams.append('start', String(start));
  url.searchParams.append('max_results', String(size));
  url.searchParams.append('sortBy', SORT[sortBy].sortBy);
  url.searchParams.append('sortOrder', 'descending');
  return url.toString();
}

/**
 * The arXiv identifier without version, from the entry's abstract URL.
 *
 * Usage:
 *   arxivId('http://arxiv.org/abs/2609.32552v1'); // '2609.32552'
 */
export function arxivId(entryUrl: string): string {
  return entryUrl.replace(/^https?:\/\/arxiv\.org\/abs\//, '').replace(/v\d+$/, '');
}

/**
 * Maps an arXiv entry to the app's article shape. The DOI is the journal's when the preprint was published,
 * otherwise the DataCite DOI arXiv assigns to every paper (10.48550/arXiv.<id>), which OpenAlex also uses.
 *
 * Usage:
 *   normalizeArxiv(entry).doi; // '10.48550/arXiv.2609.32552'
 */
export function normalizeArxiv(entry: ArxivEntry): NormalizedArticle {
  const id = arxivId(entry.id);
  const doi = entry.doi || `10.48550/arXiv.${id}`;
  const year = entry.published ? Number(entry.published.slice(0, 4)) : undefined;
  const affiliations = [...new Set(entry.authors.map((a) => a.affiliation).filter(Boolean))].join('; ');
  const authors = entry.authors.map((a) => a.name).filter(Boolean);
  return {
    doi,
    title: entry.title,
    authors: authors.join(', '),
    year,
    abstract: entry.summary || undefined,
    authorKeywords: entry.primaryCategory,
    journal: entry.journalRef || 'arXiv',
    affiliations: affiliations || undefined,
    documentType: entry.journalRef ? 'article' : 'preprint',
    source_databases: ['arXiv'],
    csl_json: {
      id: `arXiv:${id}`,
      type: entry.journalRef ? 'article-journal' : 'article',
      title: entry.title,
      DOI: doi,
      URL: entry.id,
      issued: year ? { 'date-parts': [[year]] } : undefined,
      author: authors.map((name) => ({ literal: name })),
      is_oa: 1,
    },
    is_oa: 1,
    publisher: 'arXiv',
  };
}

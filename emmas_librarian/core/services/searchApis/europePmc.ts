import type { NormalizedArticle } from '../types';
import { SEARCH_LIMITS } from '../../../src/utils/searchLimits';
import { collectPages, rateLimited, type Page, type PageCursor, type PagedResult } from './paginate';
import { logAndRethrow, type SortBy } from './shared';

const EUROPE_PMC_URL = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';

// A group author (a trial research group, a consortium) comes as collectiveName, without a person's name.
type NameParts = { fullName?: string; firstName?: string; lastName?: string; collectiveName?: string };

/** The fields of a Europe PMC result (resultType=core) that the app reads. */
export interface EuropePmcResult {
  id?: string;
  source?: string;
  pmid?: string;
  pmcid?: string;
  doi?: string;
  title?: string;
  pubYear?: string;
  abstractText?: string;
  authorList?: {
    author?: (NameParts & { authorAffiliationDetailsList?: { authorAffiliation?: { affiliation?: string }[] } })[];
  };
  journalInfo?: { volume?: string; issue?: string; journal?: { title?: string; issn?: string; essn?: string } };
  pageInfo?: string;
  isOpenAccess?: string;
  citedByCount?: number;
  keywordList?: { keyword?: string[] };
  meshHeadingList?: { meshHeading?: { descriptorName?: string }[] };
  pubTypeList?: { pubType?: string[] };
}

// Relevance is Europe PMC's default order; the other sorts are named fields.
const SORT_PARAM: Record<SortBy, string | null> = {
  relevance: null,
  citations: 'CITED desc',
  date: 'P_PDATE_D desc',
};

/**
 * Searches Europe PMC (PubMed/MEDLINE, PMC and preprints, including Cochrane reviews), following its
 * cursorMark up to `limit` (never more than SEARCH_LIMITS.europepmc.max). No key is needed.
 *
 * Usage:
 *   const { articles, available } = await searchEuropePmc('TITLE:(diabetes)', 'date', 500);
 */
export function searchEuropePmc(query: string, sortBy: SortBy, limit: number = 50): Promise<PagedResult> {
  return logAndRethrow('Europe PMC', () =>
    collectPages({
      baseName: 'Europe PMC',
      limit: Math.min(limit, SEARCH_LIMITS.europepmc.max),
      pageSize: SEARCH_LIMITS.europepmc.pageSize,
      firstCursor: '*',
      fetchPage: (cursor, size) => fetchEuropePmcPage(query, sortBy, cursor, size),
    }),
  );
}

async function fetchEuropePmcPage(query: string, sortBy: SortBy, cursor: PageCursor, size: number): Promise<Page> {
  const response = await fetch(europePmcUrl(query, sortBy, cursor, size));
  if (response.ok) {
    const data = await response.json();
    const results = (data.resultList?.result ?? []) as EuropePmcResult[];
    // Europe PMC repeats the same cursor on the last page.
    const next = data.nextCursorMark && data.nextCursorMark !== cursor ? data.nextCursorMark : null;
    return { articles: results.map(normalizeEuropePmc), next, total: data.hitCount };
  }
  if (response.status === 429) throw rateLimited('Europe PMC', response);
  throw new Error(`Erro ${response.status} no Europe PMC`);
}

function europePmcUrl(query: string, sortBy: SortBy, cursor: PageCursor, size: number): string {
  const url = new URL(EUROPE_PMC_URL);
  url.searchParams.append('query', query);
  url.searchParams.append('format', 'json');
  // "core" carries abstracts, full author lists, keywords, MeSH and the open access flag.
  url.searchParams.append('resultType', 'core');
  url.searchParams.append('pageSize', String(size));
  url.searchParams.append('cursorMark', String(cursor));
  const sort = SORT_PARAM[sortBy];
  if (sort) url.searchParams.append('sort', sort);
  return url.toString();
}

const personName = (a: NameParts) =>
  a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : a.fullName || a.collectiveName || '';

function affiliationsOf(raw: EuropePmcResult): string | undefined {
  const names = new Set<string>();
  for (const author of raw.authorList?.author ?? []) {
    for (const aff of author.authorAffiliationDetailsList?.authorAffiliation ?? []) {
      if (aff.affiliation) names.add(aff.affiliation);
    }
  }
  return names.size ? [...names].join('; ') : undefined;
}

const joined = (items: (string | undefined)[] | undefined) => {
  const values = (items ?? []).filter((v): v is string => !!v);
  return values.length ? values.join('; ') : undefined;
};

/**
 * Maps a Europe PMC result to the app's article shape (abstract without markup, MeSH as index keywords).
 *
 * Usage:
 *   normalizeEuropePmc({ title: 'T.', doi: '10.1/x', isOpenAccess: 'Y' }).is_oa; // 1
 */
export function normalizeEuropePmc(raw: EuropePmcResult): NormalizedArticle {
  const title = (raw.title || '').replace(/\.$/, '');
  const authors = (raw.authorList?.author ?? []).map(personName).filter(Boolean);
  const year = raw.pubYear ? Number(raw.pubYear) : undefined;
  const journal = raw.journalInfo?.journal;
  const isOa = raw.isOpenAccess === 'Y' ? 1 : raw.isOpenAccess === 'N' ? 0 : undefined;
  return {
    doi: raw.doi || '',
    title,
    authors: authors.join(', '),
    year,
    abstract: raw.abstractText
      ? raw.abstractText
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : undefined,
    authorKeywords: joined(raw.keywordList?.keyword),
    indexKeywords: joined(raw.meshHeadingList?.meshHeading?.map((m) => m.descriptorName)),
    journal: journal?.title,
    volume: raw.journalInfo?.volume,
    issue: raw.journalInfo?.issue,
    pages: raw.pageInfo,
    affiliations: affiliationsOf(raw),
    documentType: raw.pubTypeList?.pubType?.[0],
    issn: journal?.issn || journal?.essn,
    citationCount: raw.citedByCount,
    source_databases: ['Europe PMC'],
    csl_json: {
      id: raw.id,
      type: 'article-journal',
      title,
      DOI: raw.doi,
      PMID: raw.pmid,
      PMCID: raw.pmcid,
      issued: year ? { 'date-parts': [[year]] } : undefined,
      author: authors.map((name) => ({ literal: name })),
      is_oa: isOa,
    },
    is_oa: isOa,
  };
}

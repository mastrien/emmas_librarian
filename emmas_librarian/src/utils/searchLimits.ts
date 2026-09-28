/** The bibliographic bases the search can query, by the keys used in query maps and breakdowns. */
export type SearchBaseId = 'openalex' | 'crossref' | 'scopus' | 'wos';

interface BaseLimit {
  /** Pre-filled in the search options. */
  suggested: number;
  /** The most the app asks of this base in one search; the user may choose any value up to it. */
  max: number;
}

/**
 * How many results a search may ask of each base. Scopus stops at 5,000 (its `start` offset limit);
 * WoS 2,500 is 50 pages of 50, the whole daily quota of the free trial plan; OpenAlex and Crossref
 * publish no ceiling, so 10,000 keeps a search within their daily budgets (see
 * docs/pesquisas/2026-09-27_paginacao_apis_busca.md).
 */
export const SEARCH_LIMITS: Record<SearchBaseId, BaseLimit> = {
  openalex: { suggested: 1000, max: 10000 },
  crossref: { suggested: 1000, max: 10000 },
  scopus: { suggested: 1000, max: 5000 },
  wos: { suggested: 500, max: 2500 },
};

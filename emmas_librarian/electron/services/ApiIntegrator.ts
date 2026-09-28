import type { NormalizedArticle } from './types';
import type { SortBy } from './searchApis/shared';
import { searchOpenAlex } from './searchApis/openAlex';
import { searchCrossref } from './searchApis/crossref';
import { searchScopus } from './searchApis/scopus';
import { searchWoS } from './searchApis/wos';

/**
 * One entry point per bibliographic base, each returning normalized articles. The request and
 * normalization of every base live in electron/services/searchApis/; this class is the seam that
 * SearchOrchestrator depends on and that E2eMockApiIntegrator overrides.
 *
 * Usage:
 *   const articles = await new ApiIntegrator().searchCrossref('query.bibliographic=x', 'relevance', 50);
 */
export class ApiIntegrator {
  searchOpenAlex(filterStr: string, sortBy: SortBy, limit: number = 50): Promise<NormalizedArticle[]> {
    return searchOpenAlex(filterStr, sortBy, limit);
  }

  searchCrossref(queryStr: string, sortBy: SortBy, limit: number = 50): Promise<NormalizedArticle[]> {
    return searchCrossref(queryStr, sortBy, limit);
  }

  searchScopus(queryStr: string, apiKey: string, sortBy: SortBy, limit: number = 50): Promise<NormalizedArticle[]> {
    return searchScopus(queryStr, apiKey, sortBy, limit);
  }

  searchWoS(queryStr: string, apiKey: string, sortBy: SortBy, limit: number = 50): Promise<NormalizedArticle[]> {
    return searchWoS(queryStr, apiKey, sortBy, limit);
  }
}

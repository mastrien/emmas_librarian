import { ApiIntegrator } from './ApiIntegrator';
import type { NormalizedArticle } from './types';
import type { PagedResult } from './searchApis/paginate';

// The one article every E2E search "finds"; e2e-tests/semantic_search.spec.js asserts on it.
const E2E_ARTICLE: NormalizedArticle = {
  doi: '10.1234/e2e-mock-doi',
  title: 'Aprendizado de Maquina E2E',
  authors: 'Author E2E',
  year: 2026,
  source_databases: ['OpenAlex'],
  csl_json: {},
};

/**
 * E2E runs (E2E_MOCK_SEARCH=true) must not hit the real bibliographic APIs. This stands in for
 * ApiIntegrator so the real preview → save flow still runs, with OpenAlex returning one article.
 *
 * @example new SearchOrchestrator(db, new QueryTranslator(), new E2eMockApiIntegrator());
 */
export class E2eMockApiIntegrator extends ApiIntegrator {
  override async searchOpenAlex(): Promise<PagedResult> {
    return {
      articles: [{ ...E2E_ARTICLE, source_databases: [...E2E_ARTICLE.source_databases] }],
      requests: 1,
      available: 1,
    };
  }

  override async searchCrossref(): Promise<PagedResult> {
    return { articles: [], requests: 0 };
  }

  override async searchScopus(): Promise<PagedResult> {
    return { articles: [], requests: 0 };
  }

  override async searchWoS(): Promise<PagedResult> {
    return { articles: [], requests: 0 };
  }
}

/**
 * The integrator the app should use: the canned one when E2E_MOCK_SEARCH is exactly "true".
 *
 * @example new SearchOrchestrator(db, new QueryTranslator(), apiIntegratorFor(process.env));
 */
export function apiIntegratorFor(env: NodeJS.ProcessEnv): ApiIntegrator {
  return env.E2E_MOCK_SEARCH === 'true' ? new E2eMockApiIntegrator() : new ApiIntegrator();
}

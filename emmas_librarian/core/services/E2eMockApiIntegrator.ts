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

// What only a date-filtered query finds, so a monitored search (#52) has something new to report.
const E2E_MONITORED_ARTICLE: NormalizedArticle = {
  ...E2E_ARTICLE,
  doi: '10.1234/e2e-monitored-doi',
  title: 'Artigo Monitorado E2E',
};

/**
 * E2E runs (E2E_MOCK_SEARCH=true) must not hit the real bibliographic APIs. This stands in for
 * ApiIntegrator so the real preview → save flow still runs, with OpenAlex returning one article.
 *
 * @example new SearchOrchestrator(db, new QueryTranslator(), new E2eMockApiIntegrator());
 */
export class E2eMockApiIntegrator extends ApiIntegrator {
  override async searchOpenAlex(query = ''): Promise<PagedResult> {
    const found = query.includes('from_publication_date') ? [E2E_ARTICLE, E2E_MONITORED_ARTICLE] : [E2E_ARTICLE];
    return {
      articles: found.map((article) => ({ ...article, source_databases: [...article.source_databases] })),
      requests: 1,
      available: found.length,
    };
  }

  override async fetchCitationSeed() {
    return { openAlexId: 'W1', referencedIds: ['W2'], citedByCount: 0 };
  }

  override searchReferencedWorks(): Promise<PagedResult> {
    return this.searchOpenAlex();
  }

  override searchCitingWorks(): Promise<PagedResult> {
    return this.searchOpenAlex();
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

  override async searchEuropePmc(): Promise<PagedResult> {
    return { articles: [], requests: 0 };
  }

  override async searchArxiv(): Promise<PagedResult> {
    return { articles: [], requests: 0 };
  }

  override async searchIeee(): Promise<PagedResult> {
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

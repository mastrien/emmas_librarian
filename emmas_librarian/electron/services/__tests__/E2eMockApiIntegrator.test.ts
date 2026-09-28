import { describe, expect, it } from 'vitest';
import { ApiIntegrator } from '../ApiIntegrator';
import { E2eMockApiIntegrator, apiIntegratorFor } from '../E2eMockApiIntegrator';

describe('E2eMockApiIntegrator', () => {
  it('finds the one canned article on OpenAlex and nothing elsewhere', async () => {
    const api = new E2eMockApiIntegrator();

    const [openalex, crossref, scopus, wos] = await Promise.all([
      api.searchOpenAlex(),
      api.searchCrossref(),
      api.searchScopus(),
      api.searchWoS(),
    ]);

    expect(openalex.articles.map((a) => [a.doi, a.title, a.authors, a.year, a.source_databases])).toEqual([
      ['10.1234/e2e-mock-doi', 'Aprendizado de Maquina E2E', 'Author E2E', 2026, ['OpenAlex']],
    ]);
    expect([crossref, scopus, wos]).toEqual([
      { articles: [], requests: 0 },
      { articles: [], requests: 0 },
      { articles: [], requests: 0 },
    ]);
  });
});

describe('apiIntegratorFor', () => {
  it('uses the canned integrator only when E2E_MOCK_SEARCH is exactly "true"', () => {
    expect(apiIntegratorFor({ E2E_MOCK_SEARCH: 'true' })).toBeInstanceOf(E2eMockApiIntegrator);
    expect(apiIntegratorFor({ E2E_MOCK_SEARCH: '1' })).not.toBeInstanceOf(E2eMockApiIntegrator);
    expect(apiIntegratorFor({})).toBeInstanceOf(ApiIntegrator);
  });
});

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

describe('E2eMockApiIntegrator with a date filter', () => {
  it('also finds the article a monitored search reports as new', async () => {
    const { articles, available } = await new E2eMockApiIntegrator().searchOpenAlex(
      'q,from_publication_date:2026-01-01',
    );

    expect(articles.map((a) => a.title)).toEqual(['Aprendizado de Maquina E2E', 'Artigo Monitorado E2E']);
    expect(available).toBe(2);
  });
});

describe('E2eMockApiIntegrator bases added with pagination', () => {
  it('finds nothing on Europe PMC, arXiv and IEEE Xplore, so E2E searches never reach them', async () => {
    const api = new E2eMockApiIntegrator();

    const results = await Promise.all([api.searchEuropePmc(), api.searchArxiv(), api.searchIeee()]);

    expect(results).toEqual([
      { articles: [], requests: 0 },
      { articles: [], requests: 0 },
      { articles: [], requests: 0 },
    ]);
  });
});

describe('E2eMockApiIntegrator snowballing (#51)', () => {
  it('has one reference to explore, and answers citations with the canned article, off the network', async () => {
    const api = new E2eMockApiIntegrator();

    expect(await api.fetchCitationSeed()).toEqual({ openAlexId: 'W1', referencedIds: ['W2'], citedByCount: 0 });
    const [references, citing] = await Promise.all([api.searchReferencedWorks(), api.searchCitingWorks()]);

    expect(references.articles.map((a) => a.title)).toEqual(['Aprendizado de Maquina E2E']);
    expect(citing.articles.map((a) => a.title)).toEqual(['Aprendizado de Maquina E2E']);
  });
});

describe('apiIntegratorFor', () => {
  it('uses the canned integrator only when E2E_MOCK_SEARCH is exactly "true"', () => {
    expect(apiIntegratorFor({ E2E_MOCK_SEARCH: 'true' })).toBeInstanceOf(E2eMockApiIntegrator);
    expect(apiIntegratorFor({ E2E_MOCK_SEARCH: '1' })).not.toBeInstanceOf(E2eMockApiIntegrator);
    expect(apiIntegratorFor({})).toBeInstanceOf(ApiIntegrator);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FakeSearchApi } from './fakes/FakeSearchApi';
import { searchOpenAlex } from '../openAlex';
import { searchCrossref } from '../crossref';
import { searchScopus } from '../scopus';
import { searchWoS } from '../wos';

const param = (url: URL, name: string) => url.searchParams.get(name);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('OpenAlex paging', () => {
  it('follows the cursor 100 at a time until the limit', async () => {
    const api = new FakeSearchApi({ openalex: 1000 });
    vi.stubGlobal('fetch', api.fetch);

    const { articles, warning } = await searchOpenAlex('q', 'relevance', 250);

    expect(articles).toHaveLength(250);
    expect(api.urlsOf('openalex').map((u) => [param(u, 'cursor'), param(u, 'per_page')])).toEqual([
      ['*', '100'],
      ['c100', '100'],
      ['c200', '100'],
    ]);
    expect(warning).toBeUndefined();
  });

  it('stops when the base runs out of results', async () => {
    const api = new FakeSearchApi({ openalex: 130 });
    vi.stubGlobal('fetch', api.fetch);

    const { articles } = await searchOpenAlex('q', 'relevance', 1000);

    expect(articles).toHaveLength(130);
    expect(api.urlsOf('openalex')).toHaveLength(2);
  });

  // The free key raises the daily budget 10x; as a header it stays out of URLs and logs.
  it('sends the API key as a bearer token only when there is one', async () => {
    const api = new FakeSearchApi({ openalex: 10 });
    vi.stubGlobal('fetch', api.fetch);

    await searchOpenAlex('q', 'relevance', 10, 'chave-openalex');
    await searchOpenAlex('q', 'relevance', 10);

    expect(api.requests.map((r) => r.headers.Authorization)).toEqual(['Bearer chave-openalex', undefined]);
    expect(api.urlsOf('openalex').every((u) => !u.search.includes('chave-openalex'))).toBe(true);
  });

  it('never asks for more than its ceiling of 10,000 results', async () => {
    const api = new FakeSearchApi({ openalex: 50000 });
    vi.stubGlobal('fetch', api.fetch);

    const { articles } = await searchOpenAlex('q', 'relevance', 50000);

    expect(articles).toHaveLength(10000);
    expect(api.urlsOf('openalex')).toHaveLength(100);
  });
});

describe('Crossref paging', () => {
  it('follows next-cursor with 1,000 rows per request', async () => {
    const api = new FakeSearchApi({ crossref: 5000 });
    vi.stubGlobal('fetch', api.fetch);

    const { articles } = await searchCrossref('query.bibliographic=x', 'date', 2500);

    expect(articles).toHaveLength(2500);
    expect(api.urlsOf('crossref').map((u) => [param(u, 'cursor'), param(u, 'rows')])).toEqual([
      ['*', '1000'],
      ['c1000', '1000'],
      ['c2000', '1000'],
    ]);
    expect(param(api.urlsOf('crossref')[0], 'query.bibliographic')).toBe('x');
  });
});

describe('Scopus paging', () => {
  it('moves the start offset 200 at a time and stops at the total without an empty request', async () => {
    const api = new FakeSearchApi({ scopus: 400 });
    vi.stubGlobal('fetch', api.fetch);

    const { articles } = await searchScopus('TITLE(x)', 'key', 'relevance', 1000);

    expect(articles).toHaveLength(400);
    expect(api.urlsOf('scopus').map((u) => [param(u, 'start'), param(u, 'count')])).toEqual([
      ['0', '200'],
      ['200', '200'],
    ]);
  });

  it('keeps the pages that arrived when a later one fails, with a warning', async () => {
    const api = new FakeSearchApi({ scopus: 1000 }).failOn('scopus', 1, { status: 500 });
    vi.stubGlobal('fetch', api.fetch);

    const { articles, warning } = await searchScopus('TITLE(x)', 'key', 'relevance', 600);

    expect(articles).toHaveLength(200);
    expect(warning).toBe(
      'Scopus: a busca parou em 200 de 600 resultados (Erro 500 no Scopus). Os resultados recebidos foram mantidos.',
    );
  });

  it('fails the base when the first page fails', async () => {
    const api = new FakeSearchApi({ scopus: 1000 }).failOn('scopus', 0, { status: 401 });
    vi.stubGlobal('fetch', api.fetch);

    await expect(searchScopus('TITLE(x)', 'key', 'relevance', 600)).rejects.toThrow(
      'Chave de API inválida ou expirada',
    );
  });
});

describe('Web of Science paging', () => {
  const pauses: number[] = [];
  const sleep = async (ms: number) => {
    pauses.push(ms);
  };

  beforeEach(() => {
    pauses.length = 0;
  });

  it('asks page by page, 50 at a time, pausing over a second between requests', async () => {
    const api = new FakeSearchApi({ wos: 1000 });
    vi.stubGlobal('fetch', api.fetch);

    const { articles } = await searchWoS('TS=x', 'key', 'relevance', 120, sleep);

    expect(articles).toHaveLength(120);
    expect(api.urlsOf('wos').map((u) => [param(u, 'page'), param(u, 'limit')])).toEqual([
      ['1', '50'],
      ['2', '50'],
      ['3', '50'],
    ]);
    expect(pauses).toEqual([1100, 1100]);
  });

  it('waits what a 429 asks and retries the page once', async () => {
    const api = new FakeSearchApi({ wos: 1000 }).failOn('wos', 1, { status: 429, retryAfter: '2' });
    vi.stubGlobal('fetch', api.fetch);

    const { articles, warning } = await searchWoS('TS=x', 'key', 'relevance', 100, sleep);

    expect(articles).toHaveLength(100);
    expect(warning).toBeUndefined();
    expect(pauses).toEqual([1100, 2000]);
    expect(api.urlsOf('wos').map((u) => param(u, 'page'))).toEqual(['1', '2', '2']);
  });

  it('stops at the total the base reports', async () => {
    const api = new FakeSearchApi({ wos: 75 });
    vi.stubGlobal('fetch', api.fetch);

    const { articles } = await searchWoS('TS=x', 'key', 'relevance', 500, sleep);

    expect(articles).toHaveLength(75);
    expect(api.urlsOf('wos')).toHaveLength(2);
  });
});

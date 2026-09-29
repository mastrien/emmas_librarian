import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FakeSearchApi } from './fakes/FakeSearchApi';
import { searchOpenAlex } from '../openAlex';
import { searchCrossref } from '../crossref';
import { searchScopus } from '../scopus';
import { searchWoS } from '../wos';
import { searchEuropePmc } from '../europePmc';
import { searchArxiv } from '../arxiv';

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

    const { articles, warning, available, requests } = await searchOpenAlex('q', 'relevance', 250);

    expect(articles).toHaveLength(250);
    expect({ available, requests }).toEqual({ available: 1000, requests: 3 });
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

    const { articles, available } = await searchCrossref('query.bibliographic=x', 'date', 2500);

    expect(articles).toHaveLength(2500);
    expect(available).toBe(5000);
    expect(api.urlsOf('crossref').map((u) => [param(u, 'cursor'), param(u, 'rows')])).toEqual([
      ['*', '1000'],
      ['c1000', '1000'],
      ['c2000', '1000'],
    ]);
    expect(param(api.urlsOf('crossref')[0], 'query.bibliographic')).toBe('x');
  });
});

describe('Europe PMC paging', () => {
  it('follows cursorMark 1,000 at a time and stops when the base repeats the cursor', async () => {
    const api = new FakeSearchApi({ europepmc: 1500 });
    vi.stubGlobal('fetch', api.fetch);

    const { articles, available, requests } = await searchEuropePmc('TITLE:(x)', 'relevance', 5000);

    expect({ count: articles.length, available, requests }).toEqual({ count: 1500, available: 1500, requests: 2 });
    expect(api.urlsOf('europepmc').map((u) => [param(u, 'cursorMark'), param(u, 'pageSize')])).toEqual([
      ['*', '1000'],
      ['c1000', '1000'],
    ]);
  });

  it('asks for the core record in JSON, sorted as the user chose', async () => {
    const api = new FakeSearchApi({ europepmc: 10 });
    vi.stubGlobal('fetch', api.fetch);

    await searchEuropePmc('TITLE:(x)', 'citations', 10);
    await searchEuropePmc('TITLE:(x)', 'date', 10);
    await searchEuropePmc('TITLE:(x)', 'relevance', 10);

    const [cited, recent, relevant] = api.urlsOf('europepmc');
    expect([param(cited, 'query'), param(cited, 'format'), param(cited, 'resultType')]).toEqual([
      'TITLE:(x)',
      'json',
      'core',
    ]);
    expect([param(cited, 'sort'), param(recent, 'sort'), param(relevant, 'sort')]).toEqual([
      'CITED desc',
      'P_PDATE_D desc',
      null,
    ]);
  });
});

describe('arXiv paging', () => {
  const pauses: number[] = [];
  const sleep = async (ms: number) => {
    pauses.push(ms);
  };

  beforeEach(() => {
    pauses.length = 0;
  });

  it('moves the start offset 1,000 at a time, one request every 3 s, and reads the Atom totals', async () => {
    const api = new FakeSearchApi({ arxiv: 2500 });
    vi.stubGlobal('fetch', api.fetch);

    const { articles, available, requests } = await searchArxiv('ti:x', 'date', 5000, sleep);

    expect({ count: articles.length, available, requests }).toEqual({ count: 2500, available: 2500, requests: 3 });
    expect(api.urlsOf('arxiv').map((u) => [param(u, 'start'), param(u, 'max_results')])).toEqual([
      ['0', '1000'],
      ['1000', '1000'],
      ['2000', '1000'],
    ]);
    expect(pauses).toEqual([3000, 3000]);
    expect([param(api.urlsOf('arxiv')[0], 'sortBy'), param(api.urlsOf('arxiv')[0], 'sortOrder')]).toEqual([
      'submittedDate',
      'descending',
    ]);
  });

  // arXiv has no citation counts: the search runs by relevance and the history records why.
  it('falls back to relevance for "Mais citados" and says so in the warning', async () => {
    const api = new FakeSearchApi({ arxiv: 5 });
    vi.stubGlobal('fetch', api.fetch);

    const { warning } = await searchArxiv('ti:x', 'citations', 5, sleep);

    expect(param(api.urlsOf('arxiv')[0], 'sortBy')).toBe('relevance');
    expect(warning).toBe('O arXiv não ordena por citações; os resultados vieram por relevância.');
  });

  it('waits and retries once when arXiv says the requests came too fast', async () => {
    const api = new FakeSearchApi({ arxiv: 1500 }).failOn('arxiv', 1, { status: 429, retryAfter: '3' });
    vi.stubGlobal('fetch', api.fetch);

    const { articles, warning } = await searchArxiv('ti:x', 'relevance', 1500, sleep);

    expect(articles).toHaveLength(1500);
    expect(warning).toBeUndefined();
    expect(pauses).toEqual([3000, 3000]);
  });
});

describe('Scopus paging', () => {
  it('moves the start offset 200 at a time and stops at the total without an empty request', async () => {
    const api = new FakeSearchApi({ scopus: 400 });
    vi.stubGlobal('fetch', api.fetch);

    const { articles, available } = await searchScopus('TITLE(x)', 'key', 'relevance', 1000);

    expect(articles).toHaveLength(400);
    expect(available).toBe(400);
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

    const { articles, available } = await searchWoS('TS=x', 'key', 'relevance', 500, sleep);

    expect(articles).toHaveLength(75);
    expect(available).toBe(75);
    expect(api.urlsOf('wos')).toHaveLength(2);
  });
});

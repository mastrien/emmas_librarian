import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCitationSeed,
  OPENALEX_OR_BATCH,
  searchCitingWorks,
  searchReferencedWorks,
  shortOpenAlexId,
} from '../openAlexCitations';

/** Stands in for OpenAlex: answers each URL through `answer` and records what was asked. */
class FakeOpenAlex {
  readonly urls: URL[] = [];
  readonly inits: (RequestInit | undefined)[] = [];
  answer: (url: URL) => Response = () => FakeOpenAlex.works([]);

  static works(ids: string[]): Response {
    const results = ids.map((id) => ({ id: `https://openalex.org/${id}`, title: `Título ${id}` }));
    return new Response(JSON.stringify({ results, meta: { count: ids.length, next_cursor: null } }));
  }

  fetch = async (input: string, init?: RequestInit): Promise<Response> => {
    const url = new URL(input);
    this.urls.push(url);
    this.inits.push(init);
    return this.answer(url);
  };
}

const idsOf = (url: URL) => (url.searchParams.get('filter') ?? '').replace('openalex_id:', '').split('|');
const manyIds = (n: number) => Array.from({ length: n }, (_, i) => `W${i + 1}`);

let api: FakeOpenAlex;

beforeEach(() => {
  api = new FakeOpenAlex();
  vi.stubGlobal('fetch', api.fetch);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('shortOpenAlexId', () => {
  it('takes the id out of the url, and leaves a short one alone', () => {
    expect(shortOpenAlexId('https://openalex.org/W27')).toBe('W27');
    expect(shortOpenAlexId('W27')).toBe('W27');
  });
});

describe('fetchCitationSeed', () => {
  const seedAnswer = () =>
    new Response(
      JSON.stringify({
        id: 'https://openalex.org/W1',
        referenced_works: ['https://openalex.org/W2'],
        cited_by_count: 4,
      }),
    );

  it('reads what a work cites and how many cite it, asking only for that', async () => {
    api.answer = seedAnswer;

    expect(await fetchCitationSeed({ openAlexId: 'https://openalex.org/W1' })).toEqual({
      openAlexId: 'W1',
      referencedIds: ['W2'],
      citedByCount: 4,
    });
    expect(api.urls[0].pathname).toBe('/works/W1');
    expect(api.urls[0].searchParams.get('select')).toBe('id,referenced_works,cited_by_count');
  });

  it('finds a work by its DOI, escaped, when it has no OpenAlex id', async () => {
    api.answer = seedAnswer;

    await fetchCitationSeed({ doi: '10.1000/a b' });

    expect(api.urls[0].pathname).toBe('/works/doi:10.1000%2Fa%20b');
  });

  it('treats a work without references or citations as having none', async () => {
    api.answer = () => new Response(JSON.stringify({ id: 'https://openalex.org/W1' }));

    expect(await fetchCitationSeed({ doi: '10.1/x' })).toEqual({
      openAlexId: 'W1',
      referencedIds: [],
      citedByCount: 0,
    });
  });

  it('answers null when OpenAlex does not know the work', async () => {
    api.answer = () => new Response('{}', { status: 404 });

    expect(await fetchCitationSeed({ doi: '10.1/x' })).toBeNull();
  });

  it('sends the key as a bearer token, out of the url', async () => {
    api.answer = seedAnswer;

    await fetchCitationSeed({ doi: '10.1/x' }, 'segredo');

    expect(api.inits[0]?.headers).toEqual({ Authorization: 'Bearer segredo' });
    expect(api.urls[0].toString()).not.toContain('segredo');
  });

  it('reports a 429 and any other failure', async () => {
    api.answer = () => new Response('{}', { status: 429 });
    await expect(fetchCitationSeed({ doi: '10.1/x' })).rejects.toMatchObject({ name: 'RateLimitedError' });

    api.answer = () => new Response('{}', { status: 500 });
    await expect(fetchCitationSeed({ doi: '10.1/x' })).rejects.toThrow('Erro 500');
  });
});

describe('searchReferencedWorks', () => {
  beforeEach(() => {
    api.answer = (url) => FakeOpenAlex.works(idsOf(url));
  });

  it('asks in batches of the OR filter, never above its size', async () => {
    const { articles, requests, available } = await searchReferencedWorks(manyIds(OPENALEX_OR_BATCH + 7), 500);

    expect(api.urls.map((u) => idsOf(u).length)).toEqual([OPENALEX_OR_BATCH, 7]);
    expect(articles).toHaveLength(OPENALEX_OR_BATCH + 7);
    expect({ requests, available }).toEqual({ requests: 2, available: OPENALEX_OR_BATCH + 7 });
  });

  it('downloads up to the limit, and still says how many there were', async () => {
    const { articles, available } = await searchReferencedWorks(manyIds(120), 60);

    expect(articles).toHaveLength(60);
    expect(available).toBe(120);
  });

  it('makes no request when the work cites nothing', async () => {
    const { articles, requests } = await searchReferencedWorks([], 100);

    expect(articles).toEqual([]);
    expect(requests).toBe(0);
    expect(api.urls).toEqual([]);
  });

  it('fails when the first batch fails', async () => {
    api.answer = () => new Response('{}', { status: 429 });

    await expect(searchReferencedWorks(manyIds(3), 10)).rejects.toMatchObject({ name: 'RateLimitedError' });
  });

  it('keeps what arrived when a later batch hits the rate limit, and says why it stopped', async () => {
    let calls = 0;
    api.answer = (url) => {
      calls += 1;
      return calls === 1 ? FakeOpenAlex.works(idsOf(url)) : new Response('{}', { status: 500 });
    };

    const { articles, warning } = await searchReferencedWorks(manyIds(OPENALEX_OR_BATCH + 1), 500);

    expect(articles).toHaveLength(OPENALEX_OR_BATCH);
    expect(warning).toMatch(/Parou antes do fim/);
  });
});

describe('searchCitingWorks', () => {
  it('filters by the works that cite this one, the most cited first', async () => {
    api.answer = () => FakeOpenAlex.works(['W9']);

    const { articles } = await searchCitingWorks('https://openalex.org/W1', 10);

    expect(api.urls[0].searchParams.get('filter')).toBe('cites:W1');
    expect(api.urls[0].searchParams.get('sort')).toBe('cited_by_count:desc');
    expect(articles[0].title).toBe('Título W9');
  });
});

import { describe, it, expect } from 'vitest';
import type { NormalizedArticle } from '../../types';
import { collectPages, RateLimitedError, retryAfterMs, type Page, type PageCursor } from '../paginate';

const article = (n: number): NormalizedArticle => ({ title: `A${n}`, source_databases: ['Teste'], csl_json: {} });

/**
 * Named fake of a paged API: `total` articles served by offset, one scripted failure per request index,
 * and a record of every request and pause.
 */
class ScriptedPages {
  readonly requests: { cursor: PageCursor; size: number }[] = [];
  readonly pauses: number[] = [];
  private readonly failures = new Map<number, Error>();

  constructor(private readonly total: number) {}

  failOn(requestIndex: number, error: Error): this {
    this.failures.set(requestIndex, error);
    return this;
  }

  fetchPage = async (cursor: PageCursor, size: number): Promise<Page> => {
    const index = this.requests.push({ cursor, size }) - 1;
    const failure = this.failures.get(index);
    if (failure) throw failure;
    const start = Number(cursor);
    const articles = Array.from({ length: Math.max(0, Math.min(size, this.total - start)) }, (_, i) =>
      article(start + i),
    );
    return { articles, next: start + size };
  };

  sleep = async (ms: number): Promise<void> => {
    this.pauses.push(ms);
  };
}

const run = (api: ScriptedPages, limit: number, pageSize: number, delayMs?: number) =>
  collectPages({
    baseName: 'Teste',
    limit,
    pageSize,
    firstCursor: 0,
    fetchPage: api.fetchPage,
    sleep: api.sleep,
    delayMs,
  });

describe('collectPages', () => {
  it('asks page after page until the limit and trims the last page to it', async () => {
    const api = new ScriptedPages(1000);

    const { articles, warning } = await run(api, 250, 100);

    expect(articles.map((a) => a.title)).toEqual(Array.from({ length: 250 }, (_, i) => `A${i}`));
    expect(api.requests).toEqual([
      { cursor: 0, size: 100 },
      { cursor: 100, size: 100 },
      { cursor: 200, size: 100 },
    ]);
    expect(warning).toBeUndefined();
  });

  it('asks for only the limit when it fits in one page', async () => {
    const api = new ScriptedPages(1000);

    await run(api, 30, 100);

    expect(api.requests).toEqual([{ cursor: 0, size: 30 }]);
  });

  it('stops at a short page, when the base has no more results', async () => {
    const api = new ScriptedPages(120);

    const { articles, warning } = await run(api, 500, 50);

    expect(articles).toHaveLength(120);
    expect(api.requests).toHaveLength(3);
    expect(warning).toBeUndefined();
  });

  it('stops when the base says there is no next page', async () => {
    const pages = [{ articles: [article(1), article(2)], next: null, total: 2 }];

    const { articles } = await collectPages({
      baseName: 'Teste',
      limit: 10,
      pageSize: 2,
      firstCursor: '*',
      fetchPage: async () => pages.shift()!,
    });

    expect(articles).toHaveLength(2);
  });

  it('rejects when the first page fails: the base failed', async () => {
    const api = new ScriptedPages(1000).failOn(0, new Error('Chave de API inválida ou expirada'));

    await expect(run(api, 200, 100)).rejects.toThrow('Chave de API inválida ou expirada');
  });

  it('keeps what arrived and explains the stop when a later page fails', async () => {
    const api = new ScriptedPages(1000).failOn(2, new Error('Erro 500 no Teste'));

    const { articles, warning } = await run(api, 300, 100);

    expect(articles).toHaveLength(200);
    expect(warning).toBe(
      'Teste: a busca parou em 200 de 300 resultados (Erro 500 no Teste). Os resultados recebidos foram mantidos.',
    );
  });

  it('waits what a 429 asks, up to 5 s, and retries the same page once', async () => {
    const api = new ScriptedPages(1000).failOn(1, new RateLimitedError('Erro 429', 30000));

    const { articles } = await run(api, 200, 100);

    expect(articles).toHaveLength(200);
    expect(api.pauses).toEqual([5000]);
    expect(api.requests.map((r) => r.cursor)).toEqual([0, 100, 100]);
  });

  it('gives up after a second 429 in a row, keeping the earlier pages', async () => {
    const limited = () => new RateLimitedError('Erro 429 no Teste (limite de requisições)', 1000);
    const api = new ScriptedPages(1000).failOn(1, limited()).failOn(2, limited());

    const { articles, warning } = await run(api, 300, 100);

    expect(articles).toHaveLength(100);
    expect(warning).toContain('parou em 100 de 300 resultados (Erro 429 no Teste (limite de requisições))');
  });

  // The search history records what each base cost and how much it had, for traceability.
  it('counts every request, retries included, and keeps the total the base reported', async () => {
    const api = new ScriptedPages(1000).failOn(1, new RateLimitedError('Erro 429', 0));
    const withTotal = async (cursor: PageCursor, size: number) => ({
      ...(await api.fetchPage(cursor, size)),
      total: 1000,
    });

    const result = await collectPages({
      baseName: 'Teste',
      limit: 200,
      pageSize: 100,
      firstCursor: 0,
      fetchPage: withTotal,
      sleep: api.sleep,
    });

    expect(result.requests).toBe(3);
    expect(result.available).toBe(1000);
  });

  it('reports the requests made before a later page failed', async () => {
    const api = new ScriptedPages(1000).failOn(2, new Error('Erro 500'));

    const { requests, warning } = await run(api, 300, 100);

    expect(requests).toBe(3);
    expect(warning).toContain('parou em 200 de 300');
  });

  it('pauses between pages, not before the first one', async () => {
    const api = new ScriptedPages(1000);

    await run(api, 150, 50, 1000);

    expect(api.pauses).toEqual([1000, 1000]);
  });
});

describe('retryAfterMs', () => {
  it('reads seconds, an HTTP date, and falls back to 1 s', () => {
    const now = Date.parse('2026-09-28T12:00:00Z');

    expect(retryAfterMs('2', now)).toBe(2000);
    expect(retryAfterMs('Mon, 28 Sep 2026 12:00:03 GMT', now)).toBe(3000);
    expect(retryAfterMs(null, now)).toBe(1000);
    expect(retryAfterMs('depois', now)).toBe(1000);
  });
});

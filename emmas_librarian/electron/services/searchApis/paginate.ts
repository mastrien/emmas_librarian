import type { NormalizedArticle } from '../types';

/** Where the next page starts: an opaque cursor, an offset or a page number, depending on the base. */
export type PageCursor = string | number;

export interface Page {
  articles: NormalizedArticle[];
  /** Null when the base says there is nothing after this page. */
  next: PageCursor | null;
}

/** What one base returned for a search; `warning` says why it stopped before the limit, if it did. */
export interface PagedResult {
  articles: NormalizedArticle[];
  warning?: string;
}

/** A 429 answer: the base asked to wait `retryAfterMs` before the next request. */
export class RateLimitedError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number,
  ) {
    super(message);
    this.name = 'RateLimitedError';
  }
}

export interface PagingPlan {
  /** Shown in warnings, e.g. "Web of Science". */
  baseName: string;
  limit: number;
  /** The most one request may ask for. */
  pageSize: number;
  firstCursor: PageCursor;
  fetchPage: (cursor: PageCursor, size: number) => Promise<Page>;
  /** Pause between pages, for bases with a per-second quota. */
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

// A 429 is retried once, waiting what the base asked for but never more than this.
const MAX_RETRY_WAIT_MS = 5000;

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Requests pages one after another until `limit` articles arrived, a page comes back short or the
 * base has no next page. A failure on the first page rejects (the base failed); a failure after it
 * keeps what arrived and explains the stop in `warning`.
 *
 * Usage:
 *   const { articles, warning } = await collectPages({ baseName: 'OpenAlex', limit: 300, pageSize: 100,
 *     firstCursor: '*', fetchPage: (cursor, size) => requestOpenAlexPage(cursor, size) });
 */
export async function collectPages(plan: PagingPlan): Promise<PagedResult> {
  const sleep = plan.sleep ?? realSleep;
  // One size for every page: page-number bases (WoS) compute offsets from it.
  const size = Math.min(plan.pageSize, plan.limit);
  const articles: NormalizedArticle[] = [];
  let cursor: PageCursor | null = plan.firstCursor;
  while (cursor !== null && articles.length < plan.limit) {
    if (articles.length > 0 && plan.delayMs) await sleep(plan.delayMs);
    let page: Page;
    try {
      page = await fetchWithOneRetry(plan, cursor, size, sleep);
    } catch (err) {
      if (articles.length === 0) throw err;
      return { articles, warning: stoppedWarning(plan, articles.length, err) };
    }
    articles.push(...page.articles);
    cursor = page.articles.length < size ? null : page.next;
  }
  return { articles: articles.slice(0, plan.limit) };
}

async function fetchWithOneRetry(
  plan: PagingPlan,
  cursor: PageCursor,
  size: number,
  sleep: (ms: number) => Promise<void>,
): Promise<Page> {
  try {
    return await plan.fetchPage(cursor, size);
  } catch (err) {
    if (!(err instanceof RateLimitedError)) throw err;
    await sleep(Math.min(err.retryAfterMs, MAX_RETRY_WAIT_MS));
    return plan.fetchPage(cursor, size);
  }
}

function stoppedWarning(plan: PagingPlan, received: number, err: unknown): string {
  const reason = err instanceof Error ? err.message : String(err);
  return `${plan.baseName}: a busca parou em ${received} de ${plan.limit} resultados (${reason}). Os resultados recebidos foram mantidos.`;
}

/**
 * The error for a 429 answer, carrying how long the base asked to wait.
 *
 * Usage:
 *   if (response.status === 429) throw rateLimited('OpenAlex', response);
 */
export function rateLimited(baseName: string, response: Response): RateLimitedError {
  return new RateLimitedError(
    `Erro 429 no ${baseName} (limite de requisições)`,
    retryAfterMs(response.headers?.get('Retry-After') ?? null),
  );
}

/**
 * Milliseconds to wait from a Retry-After header (seconds or HTTP date); 1 s when absent or unreadable.
 *
 * Usage:
 *   retryAfterMs(response.headers.get('Retry-After')); // '2' → 2000
 */
export function retryAfterMs(header: string | null, now: number = Date.now()): number {
  if (!header) return 1000;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? 1000 : Math.max(0, date - now);
}

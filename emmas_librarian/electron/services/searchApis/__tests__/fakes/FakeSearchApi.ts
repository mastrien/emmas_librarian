/**
 * Named fake of the bibliographic APIs for paging tests. It holds `total` results per base and answers
 * each base's own paging protocol from the request URL: OpenAlex, Crossref and Europe PMC cursors, the
 * Scopus `start` offset and the WoS page number. `failOn` scripts an HTTP error for one request of a base.
 *
 * Usage:
 *   const api = new FakeSearchApi({ openalex: 250 });
 *   vi.stubGlobal('fetch', api.fetch);
 *   await searchOpenAlex('q', 'relevance', 250); // three requests: cursor *, c100, c200
 */
type Base = 'openalex' | 'crossref' | 'scopus' | 'wos' | 'europepmc';

interface ScriptedFailure {
  status: number;
  body?: string;
  retryAfter?: string;
}

const HOSTS: Record<string, Base> = {
  'api.openalex.org': 'openalex',
  'api.crossref.org': 'crossref',
  'api.elsevier.com': 'scopus',
  'api.clarivate.com': 'wos',
  'www.ebi.ac.uk': 'europepmc',
};

export class FakeSearchApi {
  readonly requests: { base: Base; url: URL; headers: Record<string, string> }[] = [];
  private readonly failures = new Map<string, ScriptedFailure>();

  constructor(private readonly totals: Partial<Record<Base, number>>) {}

  /** Makes the `requestIndex`-th request (0-based) to `base` answer with an HTTP error. */
  failOn(base: Base, requestIndex: number, failure: ScriptedFailure): this {
    this.failures.set(`${base}:${requestIndex}`, failure);
    return this;
  }

  urlsOf(base: Base): URL[] {
    return this.requests.filter((r) => r.base === base).map((r) => r.url);
  }

  fetch = async (input: string, init?: { headers?: Record<string, string> }): Promise<Response> => {
    const url = new URL(input);
    const base = HOSTS[url.host];
    const index = this.urlsOf(base).length;
    this.requests.push({ base, url, headers: init?.headers ?? {} });
    const failure = this.failures.get(`${base}:${index}`);
    if (failure) return errorResponse(failure);
    return jsonResponse(this.page(base, url));
  };

  private page(base: Base, url: URL): object {
    const total = this.totals[base] ?? 0;
    if (base === 'openalex')
      return this.cursorPage(url, 'per_page', total, (items, next) => ({
        results: items,
        meta: { next_cursor: next, count: total },
      }));
    if (base === 'europepmc') return this.europePmcPage(url, total);
    if (base === 'crossref')
      return this.cursorPage(url, 'rows', total, (items, next) => ({
        message: { items, 'next-cursor': next, 'total-results': total },
      }));
    if (base === 'scopus') {
      const start = Number(url.searchParams.get('start'));
      const entry = records(start, Number(url.searchParams.get('count')), total, (n) => ({
        'dc:title': `Scopus ${n}`,
      }));
      return { 'search-results': { 'opensearch:totalResults': String(total), entry } };
    }
    const size = Number(url.searchParams.get('limit'));
    const start = (Number(url.searchParams.get('page')) - 1) * size;
    return { metadata: { total }, hits: records(start, size, total, (n) => ({ uid: `WOS:${n}`, title: `WoS ${n}` })) };
  }

  // Europe PMC answers the last page with the same cursorMark it was asked for.
  private europePmcPage(url: URL, total: number) {
    const cursor = url.searchParams.get('cursorMark') ?? '*';
    const start = cursor === '*' ? 0 : Number(cursor.slice(1));
    const size = Number(url.searchParams.get('pageSize'));
    const result = records(start, size, total, (n) => ({ id: String(n), title: `Europe PMC ${n}.`, doi: `10.2/${n}` }));
    const nextCursorMark = start + size < total ? `c${start + size}` : cursor;
    return { hitCount: total, nextCursorMark, resultList: { result } };
  }

  // Cursor "*" is the start; the next cursor encodes the offset ("c200"), null after the last result.
  private cursorPage(
    url: URL,
    sizeParam: string,
    total: number,
    shape: (items: object[], next: string | null) => object,
  ) {
    const cursor = url.searchParams.get('cursor') ?? '*';
    const start = cursor === '*' ? 0 : Number(cursor.slice(1));
    const size = Number(url.searchParams.get(sizeParam));
    const items = records(start, size, total, (n) => ({ title: `Item ${n}`, id: `W${n}`, DOI: `10.1/${n}` }));
    return shape(items, start + size < total ? `c${start + size}` : null);
  }
}

function records<T>(start: number, size: number, total: number, make: (n: number) => T): T[] {
  return Array.from({ length: Math.max(0, Math.min(size, total - start)) }, (_, i) => make(start + i));
}

function jsonResponse(body: object): Response {
  return { ok: true, status: 200, json: async () => body, headers: new Headers() } as unknown as Response;
}

function errorResponse({ status, body = '{}', retryAfter }: ScriptedFailure): Response {
  const headers = new Headers(retryAfter ? { 'Retry-After': retryAfter } : {});
  return {
    ok: false,
    status,
    headers,
    json: async () => JSON.parse(body),
    text: async () => body,
  } as unknown as Response;
}

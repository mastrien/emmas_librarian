/** A response the open access code reads: status, a header, and the body as JSON, text or bytes. */
export interface HttpResponse {
  status: number;
  ok: boolean;
  header(name: string): string | null;
  json(): Promise<unknown>;
  text(): Promise<string>;
  bytes(): Promise<Buffer>;
}

/** The only network access of the open access download: GET with optional headers. */
export interface HttpClient {
  get(url: string, headers?: Record<string, string>): Promise<HttpResponse>;
}

// Some servers refuse requests without a browser-like agent; this one still names the app.
const USER_AGENT = 'Mozilla/5.0 (compatible; EmmasLibrarian; +https://github.com/mastrien/emmas_librarian)';
const TIMEOUT_MS = 30000;

/**
 * The HttpClient backed by the platform fetch, following redirects, with a 30 s timeout per request.
 *
 * Usage:
 *   const response = await fetchHttpClient.get('https://arxiv.org/pdf/2609.32552');
 */
export const fetchHttpClient: HttpClient = {
  async get(url, headers = {}) {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, ...headers },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return {
      status: response.status,
      ok: response.ok,
      header: (name) => response.headers.get(name),
      json: () => response.json(),
      text: () => response.text(),
      bytes: async () => Buffer.from(await response.arrayBuffer()),
    };
  },
};

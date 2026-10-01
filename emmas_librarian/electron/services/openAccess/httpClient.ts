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
// Two deadlines: a server that does not answer in 30 s is down, but a slow one may need minutes to send a
// large PDF (Copernicus took 35 s for 11.6 MB in docs/pesquisas/2026-09-29_pdfs_acesso_aberto.md).
export const RESPONSE_TIMEOUT_MS = 30000;
export const BODY_TIMEOUT_MS = 180000;

/** Aborts the request when a deadline passes; `restart` moves the deadline, `clear` drops it. */
function deadline(ms: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const restart = (after: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(new Error(`Tempo esgotado após ${after / 1000} s`)), after);
  };
  restart(ms);
  return { signal: controller.signal, restart, clear: () => clearTimeout(timer) };
}

/**
 * The HttpClient backed by the platform fetch, following redirects: 30 s for the server to answer, then
 * 3 min to read the body.
 *
 * Usage:
 *   const response = await fetchHttpClient.get('https://arxiv.org/pdf/2609.32552');
 */
export const fetchHttpClient: HttpClient = {
  async get(url, headers = {}) {
    const timeout = deadline(RESPONSE_TIMEOUT_MS);
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, ...headers },
      redirect: 'follow',
      signal: timeout.signal,
    }).catch((err: unknown) => {
      timeout.clear();
      throw err;
    });
    timeout.restart(BODY_TIMEOUT_MS);
    const read = <T>(body: () => Promise<T>) => body().finally(timeout.clear);
    return {
      status: response.status,
      ok: response.ok,
      header: (name) => response.headers.get(name),
      json: () => read(() => response.json()),
      text: () => read(() => response.text()),
      bytes: () => read(async () => Buffer.from(await response.arrayBuffer())),
    };
  },
};

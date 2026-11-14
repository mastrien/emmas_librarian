import type { TokenStore } from '../../pairing';

interface Recorded {
  route: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

const json = (status: number, document: unknown) =>
  new Response(JSON.stringify(document), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * The desktop's LAN server as `fetch` sees it: answers the ping, trades `code` for `token`, and runs
 * commands for that token from `results` (channel -> result). `present = false` is the copy of the
 * page published on the web, where there is no server at all.
 *
 * Usage:
 *   const desktop = new FakeDesktopServer();
 *   desktop.results['projects:getAll'] = [{ id: 1, name: 'Tese' }];
 *   render(<App environment={environmentFor(desktop, { hash: '#pair=codigo' })} />);
 */
export class FakeDesktopServer {
  present = true;
  code = 'codigo';
  token = 'token-do-celular';
  pairStatus = 200;
  results: Record<string, unknown> = {};
  bytes: Record<string, Uint8Array> = {};
  requests: Recorded[] = [];

  send: typeof fetch = async (input, init) => {
    const route = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined;
    this.requests.push({ route, method: init?.method ?? 'GET', headers, body });
    if (!this.present) return new Response('<html>404</html>', { status: 404 });
    if (route === '/api/ping') return json(200, { ok: true, result: { app: 'emmas-librarian' } });
    if (route === '/api/pair') return this.pair(body as { code?: string });
    return this.command(decodeURIComponent(route.replace('/api/commands/', '')), headers);
  };

  private pair(body: { code?: string }): Response {
    if (this.pairStatus !== 200) return json(this.pairStatus, { ok: false, error: { code: 'ERR_REMOTE_THROTTLED' } });
    if (body.code !== this.code) return json(403, { ok: false, error: { code: 'ERR_PAIRING_REFUSED' } });
    return json(200, { ok: true, result: { token: this.token, deviceId: 'd1' } });
  }

  private command(channel: string, headers: Record<string, string>): Response {
    if (headers.Authorization !== `Bearer ${this.token}`) {
      const message = 'Token ausente, inválido ou revogado';
      return json(401, { ok: false, error: { code: 'ERR_REMOTE_UNAUTHORIZED', message } });
    }
    if (channel in this.bytes) return new Response(this.bytes[channel].slice().buffer as ArrayBuffer, { status: 200 });
    if (channel in this.results) return json(200, { ok: true, result: this.results[channel] });
    return json(400, { ok: false, error: { code: 'ERR_NOT_FOUND', message: `[ERR_NOT_FOUND] ${channel}` } });
  }
}

/** A token store in memory; `stored` is what a later visit would find. */
export class MemoryTokenStore implements TokenStore {
  constructor(public stored: string | null = null) {}

  read = () => this.stored;
  write = (token: string) => {
    this.stored = token;
  };
  clear = () => {
    this.stored = null;
  };
}

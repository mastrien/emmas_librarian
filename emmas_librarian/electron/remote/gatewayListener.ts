import type { IncomingMessage, RequestListener, ServerResponse } from 'http';
import type { GatewayRequest, GatewayResponse, RemoteGateway } from '../../core/remote/RemoteGateway';
import type { StaticSite } from './staticSite';

/** Bodies are command arguments (a diary page at most); anything bigger is not a legitimate request. */
export const MAX_BODY_BYTES = 1_000_000;

export interface GatewayListenerOptions {
  /** The web pages served beside the API (the mobile client): asked for every GET outside /api/. */
  site?: StaticSite;
}

const TOO_LARGE: GatewayResponse = {
  status: 413,
  contentType: 'application/json; charset=utf-8',
  body: JSON.stringify({
    ok: false,
    error: {
      code: 'ERR_REMOTE_TOO_LARGE',
      type: 'VALIDATION_ERROR',
      message: `[ERR_REMOTE_TOO_LARGE] Corpo grande demais. Expected shape: até ${MAX_BODY_BYTES} bytes.`,
    },
  }),
};

/** The body of a request, or null when it passes the limit (the rest is not read). */
function readBody(req: IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) return resolve(null);
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const pathOf = (req: IncomingMessage) => new URL(req.url ?? '/', 'http://localhost').pathname;

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function gatewayRequestOf(req: IncomingMessage, body: Buffer): GatewayRequest {
  const headers = Object.fromEntries(Object.entries(req.headers).map(([name, value]) => [name, firstValue(value)]));
  return {
    method: req.method ?? 'GET',
    path: pathOf(req),
    headers,
    body,
    remoteAddress: req.socket.remoteAddress ?? 'unknown',
  };
}

// The pages may run only their own scripts and talk only to this server. pdf.js draws from blob: and
// data: images and starts its worker from a file of the site; styles are set inline by React.
const PAGE_POLICY =
  "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

function send(res: ServerResponse, response: GatewayResponse): void {
  const body = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body, 'utf8');
  res.writeHead(response.status, {
    'Content-Type': response.contentType,
    'Content-Length': body.length,
    // Library data must not linger in a browser's or a proxy's cache.
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(response.contentType.startsWith('text/html') && { 'Content-Security-Policy': PAGE_POLICY }),
  });
  res.end(body);
}

function pageFor(req: IncomingMessage, site: StaticSite | undefined): GatewayResponse | null {
  const pathname = pathOf(req);
  if (!site || req.method !== 'GET' || pathname.startsWith('/api/')) return null;
  return site(pathname);
}

/**
 * Plugs a RemoteGateway into a Node HTTP or HTTPS server.
 *
 * Usage:
 *   https.createServer({ key, cert }, gatewayListener(gateway, { landingPage })).listen(port);
 */
export function gatewayListener(gateway: RemoteGateway, options: GatewayListenerOptions = {}): RequestListener {
  return (req, res) => {
    void (async () => {
      const page = pageFor(req, options.site);
      if (page) return send(res, page);
      const body = await readBody(req);
      send(res, body === null ? TOO_LARGE : await gateway.handle(gatewayRequestOf(req, body)));
    })().catch(() => res.destroy());
  };
}

import type { IncomingMessage, RequestListener, ServerResponse } from 'http';
import type { GatewayRequest, GatewayResponse, RemoteGateway } from '../../core/remote/RemoteGateway';

/** Bodies are command arguments (a diary page at most); anything bigger is not a legitimate request. */
export const MAX_BODY_BYTES = 1_000_000;

export interface GatewayListenerOptions {
  /** HTML answered for `GET /`, so someone who opens the address in a browser sees what it is. */
  landingPage?: string;
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

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function gatewayRequestOf(req: IncomingMessage, body: Buffer): GatewayRequest {
  const headers = Object.fromEntries(Object.entries(req.headers).map(([name, value]) => [name, firstValue(value)]));
  return {
    method: req.method ?? 'GET',
    path: new URL(req.url ?? '/', 'http://localhost').pathname,
    headers,
    body,
    remoteAddress: req.socket.remoteAddress ?? 'unknown',
  };
}

function send(res: ServerResponse, response: GatewayResponse): void {
  const body = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body, 'utf8');
  res.writeHead(response.status, {
    'Content-Type': response.contentType,
    'Content-Length': body.length,
    // Library data must not linger in a browser's or a proxy's cache.
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

const isLanding = (req: IncomingMessage) => req.method === 'GET' && (req.url === '/' || req.url === '/index.html');

/**
 * Plugs a RemoteGateway into a Node HTTP or HTTPS server.
 *
 * Usage:
 *   https.createServer({ key, cert }, gatewayListener(gateway, { landingPage })).listen(port);
 */
export function gatewayListener(gateway: RemoteGateway, options: GatewayListenerOptions = {}): RequestListener {
  return (req, res) => {
    void (async () => {
      if (options.landingPage && isLanding(req)) {
        return send(res, { status: 200, contentType: 'text/html; charset=utf-8', body: options.landingPage });
      }
      const body = await readBody(req);
      send(res, body === null ? TOO_LARGE : await gateway.handle(gatewayRequestOf(req, body)));
    })().catch(() => res.destroy());
  };
}

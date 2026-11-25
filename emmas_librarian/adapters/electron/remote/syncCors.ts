import type { IncomingMessage } from 'http';

/**
 * The origin of the Android app's WebView (capacitor.config.ts: androidScheme 'https', hostname 'localhost').
 * With CapacitorHttp on, the app's fetch goes through the native layer and sends no Origin at all; this entry is the
 * fallback for the case where the WebView's own fetch is used (#208).
 */
export const WEBVIEW_ORIGIN = 'https://localhost';

/** Only the plain-HTTP sync port opts in; the HTTPS gateway and /api/commands/* never get CORS headers. */
export interface SyncCorsOptions {
  allowedOrigins: readonly string[];
}

const SYNC_PATH_PREFIX = '/api/sync/';
const PREFLIGHT_MAX_AGE_SECONDS = '600';

type HeaderMap = { [name: string]: string };

/** The origin the browser says the page comes from, when this port allows it to read sync answers. */
function allowedOriginOf(req: IncomingMessage, cors: SyncCorsOptions | undefined): string | null {
  const origin = req.headers.origin;
  if (!cors || typeof origin !== 'string') return null;
  return cors.allowedOrigins.includes(origin) ? origin : null;
}

function isSyncRequest(req: IncomingMessage): boolean {
  return new URL(req.url ?? '/', 'http://localhost').pathname.startsWith(SYNC_PATH_PREFIX);
}

/**
 * The headers of the answer to the preflight (OPTIONS) of a sync call, or null when the request is not one from an
 * allowed origin (it then falls to the gateway, which answers 404 with no CORS headers, as before).
 *
 * @example syncPreflightHeaders(req, { allowedOrigins: [WEBVIEW_ORIGIN] }) // { 'Access-Control-Allow-Origin': 'https://localhost', ... }
 */
export function syncPreflightHeaders(req: IncomingMessage, cors: SyncCorsOptions | undefined): HeaderMap | null {
  const origin = allowedOriginOf(req, cors);
  if (req.method !== 'OPTIONS' || !origin || !isSyncRequest(req)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': PREFLIGHT_MAX_AGE_SECONDS,
    Vary: 'Origin',
  };
}

/** The header that lets an allowed page read the answer to a sync call; empty for any other request. */
export function syncAnswerHeaders(req: IncomingMessage, cors: SyncCorsOptions | undefined): HeaderMap {
  const origin = allowedOriginOf(req, cors);
  if (!origin || !isSyncRequest(req)) return {};
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}

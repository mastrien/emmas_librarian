const PAIR_PREFIX = '#pair=';
const TOKEN_KEY = 'emma.deviceToken';

/**
 * The one-time code a pairing QR code carries in the page address, or null.
 *
 * @example pairingCodeFrom('#pair=abc123') // 'abc123'
 */
export function pairingCodeFrom(hash: string): string | null {
  return hash.startsWith(PAIR_PREFIX) && hash.length > PAIR_PREFIX.length ? hash.slice(PAIR_PREFIX.length) : null;
}

/**
 * A name the person will recognise in the desktop's list of paired phones.
 *
 * @example deviceNameFrom('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 ...) Safari/604.1') // 'iPhone (Safari)'
 */
export function deviceNameFrom(userAgent: string): string {
  const device = /iPhone|iPad|Android/.exec(userAgent)?.[0] ?? 'Navegador';
  const browser = /Firefox|FxiOS|Edg|CriOS|Chrome|Safari/.exec(userAgent)?.[0] ?? '';
  const names: Record<string, string> = { FxiOS: 'Firefox', CriOS: 'Chrome', Edg: 'Edge' };
  return browser ? `${device} (${names[browser] ?? browser})` : device;
}

/** Why a pairing did not happen, in words for the screen. */
export class PairingError extends Error {}

/**
 * Trades the code of the QR code for this device's token.
 *
 * Usage:
 *   const token = await pairWithDesktop(code, deviceNameFrom(navigator.userAgent));
 */
export async function pairWithDesktop(
  code: string,
  deviceName: string,
  send: typeof fetch = (...args) => fetch(...args),
): Promise<string> {
  const response = await send('/api/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, deviceName }),
  });
  const reply = (await response.json().catch(() => ({}))) as { result?: { token?: string } };
  if (response.ok && reply.result?.token) return reply.result.token;
  const reason = response.status === 429 ? 'Muitas tentativas; espere um minuto.' : 'O código já foi usado ou venceu.';
  throw new PairingError(`${reason} Abra um novo código no computador e leia de novo.`);
}

/** Where the device token is kept between visits; a browser that blocks storage simply forgets it. */
export interface TokenStore {
  read(): string | null;
  write(token: string): void;
  clear(): void;
}

/**
 * The token in the browser's localStorage (private windows may refuse it: every access is guarded).
 *
 * Usage:
 *   const tokens = browserTokenStore(window.localStorage);
 */
export function browserTokenStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): TokenStore {
  const quietly = <T>(action: () => T, fallback: T): T => {
    try {
      return action();
    } catch {
      return fallback;
    }
  };
  return {
    read: () => quietly(() => storage.getItem(TOKEN_KEY), null),
    write: (token) => quietly(() => storage.setItem(TOKEN_KEY, token), undefined),
    clear: () => quietly(() => storage.removeItem(TOKEN_KEY), undefined),
  };
}

/**
 * Whether this page was served by the desktop app (and can therefore talk to it), as opposed to the
 * copy published on the web, which only opens files.
 *
 * Usage:
 *   if (await isServedByDesktop()) showConnectHelp();
 */
export async function isServedByDesktop(send: typeof fetch = (...args) => fetch(...args)): Promise<boolean> {
  try {
    const response = await send('/api/ping');
    const reply = (await response.json()) as { result?: { app?: string } };
    return response.ok && reply.result?.app === 'emmas-librarian';
  } catch {
    return false;
  }
}

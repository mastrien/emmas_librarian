import { WebCryptoProvider } from '../../../core/sync/crypto/WebCryptoProvider';
import type { LocalAppEnvironment } from '../App';
import { deviceNameFrom } from '../session/pairing';
import { IndexedDbStorage, openMobileDatabase } from './IndexedDbStorage';
import { LocalWorkspace } from './LocalWorkspace';

/** What the page offers that the workspace builds on; tests pass fakes. */
export interface BrowserParts {
  indexedDB: IDBFactory;
  crypto: Crypto;
  fetch: typeof fetch;
  userAgent: string;
  /** "https:" for the web copy and the desktop-served page, "http:" or a custom scheme in the app. */
  protocol: string;
  /** True inside the Capacitor app: its `fetch` goes through CapacitorHttp, which may call plain HTTP (#208). */
  native?: boolean;
  newUuid: () => string;
  scan?: () => Promise<string>;
}

/**
 * Whether the computer must be reached over HTTPS. A web page served over HTTPS may not call plain HTTP (mixed
 * content), but the app is also served from "https://localhost" and its requests are native, so it may; asking for
 * HTTPS there sent it to the computer's self-signed certificate, which Android refuses (#208).
 *
 * @example mustUseHttps('https:', true) // false: the app uses the plain sync port
 */
export function mustUseHttps(protocol: string, native: boolean): boolean {
  return protocol === 'https:' && !native;
}

/**
 * Wires the phone's workspace to the browser (or the Capacitor WebView): IndexedDB for its library and PDFs, Web
 * Crypto for the cipher, `fetch` for the computer.
 *
 * @example const local = browserLocalEnvironment({ indexedDB, crypto, fetch, userAgent: navigator.userAgent, … });
 */
export function browserLocalEnvironment(parts: BrowserParts): LocalAppEnvironment {
  return {
    scan: parts.scan,
    open: async () => {
      const storage = new IndexedDbStorage(await openMobileDatabase(parts.indexedDB));
      return LocalWorkspace.open({
        state: storage,
        pdfs: storage,
        identity: storage,
        wipe: () => storage.clear(),
        crypto: new WebCryptoProvider(parts.crypto),
        send: (...args) => parts.fetch(...args),
        clock: { now: () => new Date().toISOString(), newUuid: parts.newUuid },
        deviceName: deviceNameFrom(parts.userAgent),
        secureOnly: mustUseHttps(parts.protocol, parts.native === true),
      });
    },
  };
}

/** Whether the phone's own library is on: always in the app; in a browser only when asked (`#/?local=1` once). */
export function wantsLocalLibrary(
  search: string,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  native: boolean,
): boolean {
  if (native) return true;
  try {
    if (new URLSearchParams(search).get('local') === '1') storage.setItem('emma.local', '1');
    return storage.getItem('emma.local') === '1';
  } catch {
    return false;
  }
}

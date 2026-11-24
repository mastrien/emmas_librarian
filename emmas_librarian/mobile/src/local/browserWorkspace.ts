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
  newUuid: () => string;
  scan?: () => Promise<string>;
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
        secureOnly: parts.protocol === 'https:',
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

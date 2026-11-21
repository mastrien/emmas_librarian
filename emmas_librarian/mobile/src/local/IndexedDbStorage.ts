import type { LibraryState } from './libraryState';
import type { IdentityStorage, PairedDesktop } from '../sync/phonePairing';
import type { PdfStorage, StateStorage } from './storage';

const DB_NAME = 'emma-mobile';
const STATE_STORE = 'state';
const PDF_STORE = 'pdfs';
const STATE_KEY = 'library';
const IDENTITY_KEY = 'identity';

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error ?? new Error('IndexedDB request failed'));
  });
}

/** Opens (and on first use creates) the phone's database; `factory` is `indexedDB`, or a fake in tests. */
export function openMobileDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = factory.open(DB_NAME, 1);
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore(STATE_STORE);
      opening.result.createObjectStore(PDF_STORE);
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error ?? new Error(`Could not open the "${DB_NAME}" database`));
  });
}

/**
 * The library's state and its PDFs in the browser's IndexedDB, which both the PWA and the Capacitor WebView have.
 * Data lives only on this phone; clearing the app's storage forgets it, and the next sync brings it back.
 *
 * Usage:
 *   const storage = new IndexedDbStorage(await openMobileDatabase(indexedDB));
 */
export class IndexedDbStorage implements StateStorage, PdfStorage, IdentityStorage {
  constructor(private readonly db: IDBDatabase) {}

  public async load(): Promise<LibraryState | null> {
    const found = await request(this.store(STATE_STORE, 'readonly').get(STATE_KEY));
    return (found as LibraryState | undefined) ?? null;
  }

  public async save(state: LibraryState): Promise<void> {
    await request(this.store(STATE_STORE, 'readwrite').put(state, STATE_KEY));
  }

  public async loadIdentity(): Promise<PairedDesktop | null> {
    const found = await request(this.store(STATE_STORE, 'readonly').get(IDENTITY_KEY));
    return (found as PairedDesktop | undefined) ?? null;
  }

  public async saveIdentity(desktop: PairedDesktop): Promise<void> {
    await request(this.store(STATE_STORE, 'readwrite').put(desktop, IDENTITY_KEY));
  }

  public async get(articleUuid: string): Promise<Uint8Array | null> {
    const found = await request(this.store(PDF_STORE, 'readonly').get(articleUuid));
    return found ? new Uint8Array(found as ArrayBuffer) : null;
  }

  public async put(articleUuid: string, bytes: Uint8Array): Promise<void> {
    await request(this.store(PDF_STORE, 'readwrite').put(bytes.slice().buffer, articleUuid));
  }

  public async remove(articleUuid: string): Promise<void> {
    await request(this.store(PDF_STORE, 'readwrite').delete(articleUuid));
  }

  public async sizes(): Promise<{ [articleUuid: string]: number }> {
    const store = this.store(PDF_STORE, 'readonly');
    const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())]);
    return Object.fromEntries(keys.map((key, index) => [String(key), (values[index] as ArrayBuffer).byteLength]));
  }

  /** Forgets everything on this phone (unpairing): the state and every PDF. */
  public async clear(): Promise<void> {
    await Promise.all([
      request(this.store(STATE_STORE, 'readwrite').clear()),
      request(this.store(PDF_STORE, 'readwrite').clear()),
    ]);
  }

  private store(name: string, mode: IDBTransactionMode): IDBObjectStore {
    return this.db.transaction(name, mode).objectStore(name);
  }
}

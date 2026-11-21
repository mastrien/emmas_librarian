import type { LibraryState } from './libraryState';

/** Where the library's state lives between runs of the app: one document, replaced as a whole. */
export interface StateStorage {
  load(): Promise<LibraryState | null>;
  save(state: LibraryState): Promise<void>;
}

/** Where downloaded PDFs live, by the uuid of their article. They are big, so they are stored apart from the state. */
export interface PdfStorage {
  get(articleUuid: string): Promise<Uint8Array | null>;
  put(articleUuid: string, bytes: Uint8Array): Promise<void>;
  remove(articleUuid: string): Promise<void>;
  /** uuid → size in bytes, for "PDF no celular · 2,4 MB" and the storage summary. */
  sizes(): Promise<{ [articleUuid: string]: number }>;
}

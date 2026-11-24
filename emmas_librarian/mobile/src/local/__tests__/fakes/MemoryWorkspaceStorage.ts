import type { IdentityStorage, PairedDesktop } from '../../../sync/phonePairing';
import type { LibraryState } from '../../libraryState';
import type { PdfStorage, StateStorage } from '../../storage';
import { MemoryPdfStorage } from './MemoryPdfStorage';

/** Everything the phone keeps, in memory, so a test can "close the app" and open it again on the same data. */
export class MemoryWorkspaceStorage implements StateStorage, IdentityStorage {
  public state: LibraryState | null = null;
  public identity: PairedDesktop | null = null;
  public readonly pdfs: PdfStorage = new MemoryPdfStorage();

  public async load(): Promise<LibraryState | null> {
    return this.state ? (JSON.parse(JSON.stringify(this.state)) as LibraryState) : null;
  }
  public async save(state: LibraryState): Promise<void> {
    this.state = JSON.parse(JSON.stringify(state)) as LibraryState;
  }
  public async loadIdentity(): Promise<PairedDesktop | null> {
    return this.identity;
  }
  public async saveIdentity(desktop: PairedDesktop): Promise<void> {
    this.identity = desktop;
  }
  public async wipe(): Promise<void> {
    this.state = null;
    this.identity = null;
  }
}

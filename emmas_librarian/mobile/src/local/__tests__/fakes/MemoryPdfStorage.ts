import type { PdfStorage } from '../../storage';

/** PDFs kept in memory, for tests of what reads and downloads them. */
export class MemoryPdfStorage implements PdfStorage {
  private readonly files = new Map<string, Uint8Array>();

  public async get(articleUuid: string): Promise<Uint8Array | null> {
    return this.files.get(articleUuid) ?? null;
  }

  public async put(articleUuid: string, bytes: Uint8Array): Promise<void> {
    this.files.set(articleUuid, bytes);
  }

  public async remove(articleUuid: string): Promise<void> {
    this.files.delete(articleUuid);
  }

  public async sizes(): Promise<{ [articleUuid: string]: number }> {
    return Object.fromEntries([...this.files].map(([uuid, bytes]) => [uuid, bytes.length]));
  }
}

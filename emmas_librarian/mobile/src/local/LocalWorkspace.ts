import type { CryptoProvider } from '../../../core/sync/crypto/CryptoProvider';
import { PhoneSyncClient, type SyncReport } from '../sync/PhoneSyncClient';
import { HttpSyncTransport } from '../sync/HttpSyncTransport';
import {
  identityOf,
  pairPhone,
  parseScannedOffer,
  type IdentityStorage,
  type PairedDesktop,
} from '../sync/phonePairing';
import { LocalLibrary, type LibraryClock } from './LocalLibrary';
import { LocalProjectReader } from './LocalProjectReader';
import { emptyState, type LibraryState } from './libraryState';
import type { PdfStorage, StateStorage } from './storage';

/** What the workspace needs from the phone; tests pass fakes for each. */
export interface WorkspaceEnvironment {
  state: StateStorage;
  pdfs: PdfStorage;
  identity: IdentityStorage;
  /** Forgets all of it on this phone (unpairing). */
  wipe: () => Promise<void>;
  crypto: CryptoProvider;
  send: typeof fetch;
  clock: LibraryClock;
  deviceName: string;
  /** True where the page is served over HTTPS (the web copy): it may not call the plain-HTTP sync port. */
  secureOnly?: boolean;
}

export interface WorkspaceStatus {
  pairedTo: string | null;
  verificationCode: string | null;
  pendingChanges: number;
  lastSyncAt: string | null;
  lastError: string | null;
  syncing: boolean;
}

/**
 * Everything the phone app holds: its copy of the library, the PDFs it kept, who it is paired with, and the
 * operations on them (pair, sync, download a PDF, unpair). The screens talk to this, never to storage or HTTP.
 *
 * Usage:
 *   const workspace = await LocalWorkspace.open(environment);
 *   await workspace.pair(scannedText);
 *   await workspace.syncNow();
 */
export class LocalWorkspace {
  public readonly reader: LocalProjectReader;
  private lastSyncAt: string | null = null;
  private lastError: string | null = null;
  private syncing = false;
  private readonly listeners = new Set<() => void>();

  private constructor(
    public readonly library: LocalLibrary,
    private readonly env: WorkspaceEnvironment,
    private desktop: PairedDesktop | null,
  ) {
    this.reader = new LocalProjectReader(library, env.pdfs);
  }

  /** Opens what this phone saved last time, or starts empty. */
  public static async open(env: WorkspaceEnvironment): Promise<LocalWorkspace> {
    const desktop = await env.identity.loadIdentity();
    const saved = await env.state.load();
    const state: LibraryState = saved ?? emptyState(desktop?.deviceId ?? env.clock.newUuid());
    // The saved copy is written after every change; a failed write is reported on the next sync, not here.
    const library = new LocalLibrary(state, env.clock, () => void env.state.save(state).catch(() => undefined));
    return new LocalWorkspace(library, env, desktop);
  }

  public status(): WorkspaceStatus {
    return {
      pairedTo: this.desktop?.deviceName ?? null,
      verificationCode: this.desktop?.verificationCode ?? null,
      pendingChanges: this.library.state.outbox.length,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError,
      syncing: this.syncing,
    };
  }

  public isPaired(): boolean {
    return this.desktop !== null;
  }

  /** Tells the screens something changed (a sync started or ended, a pairing was made). */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** @throws Error with the reason in words for the screen, when the code is wrong, expired or already used */
  public async pair(scannedText: string): Promise<PairedDesktop> {
    const offer = parseScannedOffer(scannedText);
    this.desktop = await pairPhone(
      this.env.crypto,
      offer,
      this.env.deviceName,
      this.env.identity,
      this.env.send,
      Date.now,
      this.env.secureOnly,
    );
    this.library.state.deviceId = this.desktop.deviceId;
    this.changed();
    return this.desktop;
  }

  /** One round trip with the computer. A failure is kept in the status and thrown, so a screen can show it. */
  public async syncNow(): Promise<SyncReport> {
    const client = this.clientOrThrow();
    this.syncing = true;
    this.changed();
    try {
      const report = await client.sync();
      this.lastSyncAt = this.env.clock.now();
      this.lastError = null;
      return report;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      this.syncing = false;
      this.changed();
    }
  }

  /** Keeps the PDF of an article on this phone. Returns false when the computer has none for it. */
  public async downloadPdf(articleId: number): Promise<boolean> {
    const article = this.library.rows('articles').find((row) => row.id === articleId);
    if (!article) throw new Error(`No article with id ${articleId} on this phone`);
    const bytes = await this.clientOrThrow().fetchPdf(article.uuid);
    if (!bytes) return false;
    await this.env.pdfs.put(article.uuid, bytes);
    this.changed();
    return true;
  }

  /** Keeps a PDF the person picked on the phone (for an article of a project made here). */
  public async attachPdf(articleId: number, bytes: Uint8Array): Promise<void> {
    const article = this.library.rows('articles').find((row) => row.id === articleId);
    if (!article) throw new Error(`No article with id ${articleId} on this phone`);
    await this.env.pdfs.put(article.uuid, bytes);
    this.changed();
  }

  /** What unpairing would throw away, to show before asking. */
  public lossesOnUnpair(): { pendingChanges: number; ownProjects: number } {
    const own = Object.values(this.library.state.origins).filter((origin) => origin === 'own').length;
    return { pendingChanges: this.library.state.outbox.length, ownProjects: own };
  }

  /** Forgets the pairing and the copy of the library (plan 2026-11-21); projects made here are lost too. */
  public async unpair(): Promise<void> {
    await this.env.wipe();
    this.desktop = null;
    const fresh = emptyState(this.env.clock.newUuid());
    Object.assign(this.library.state, fresh);
    this.changed();
  }

  private clientOrThrow(): PhoneSyncClient {
    if (!this.desktop)
      throw new Error('This phone is not paired with a computer; read the QR code of "Parear um celular".');
    const transport = new HttpSyncTransport(this.desktop.baseUrl, this.env.send);
    return new PhoneSyncClient(this.env.crypto, identityOf(this.desktop), this.library, transport);
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }
}

import type Database from 'better-sqlite3';
import fs from 'fs';
import { ChangeLog } from './ChangeLog';
import { OperationBuilder } from './OperationBuilder';
import { PendingChangeStore } from './PendingChangeStore';
import { RowExporter } from './RowExporter';
import { installSyncSchema } from './syncSchema';

/** The id the computer signs its own operations with. */
const DESKTOP_ID = 'desktop';

export interface LibrarySyncParts {
  log: ChangeLog;
  builder: OperationBuilder;
  store: PendingChangeStore;
  /** The PDF of an article by uuid, read from the file this computer keeps; null when there is none. */
  readPdf: (articleUuid: string) => Uint8Array | null;
}

/**
 * The sync side of one open library. Nothing is installed until `parts()` is first called (which happens when
 * the user opens a pairing), so a library that never syncs pays nothing: no side tables, no triggers.
 *
 * Usage:
 *   const { store } = library.parts();
 *   store.listPending();
 */
export class LibrarySync {
  private built: LibrarySyncParts | null = null;

  constructor(private readonly db: Database.Database) {}

  public parts(): LibrarySyncParts {
    if (this.built) return this.built;
    installSyncSchema(this.db);
    const log = new ChangeLog(this.db);
    const exporter = new RowExporter(this.db, log);
    this.built = {
      log,
      builder: new OperationBuilder(log, exporter, DESKTOP_ID),
      store: new PendingChangeStore(this.db, log, exporter),
      readPdf: (articleUuid) => this.readPdf(log, articleUuid),
    };
    return this.built;
  }

  private readPdf(log: ChangeLog, articleUuid: string): Uint8Array | null {
    const localId = log.localIdOf('articles', articleUuid);
    if (localId === undefined) return null;
    const row = this.db.prepare('SELECT local_file_path FROM articles WHERE id = ?').get(localId) as
      | { local_file_path: string | null }
      | undefined;
    const file = row?.local_file_path;
    return file && fs.existsSync(file) ? fs.readFileSync(file) : null;
  }
}

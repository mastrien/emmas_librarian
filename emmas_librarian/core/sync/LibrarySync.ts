import type Database from 'better-sqlite3';
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
    };
    return this.built;
  }
}

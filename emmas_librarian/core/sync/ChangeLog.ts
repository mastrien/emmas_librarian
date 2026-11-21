import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { syncedTable, type SyncedEntity } from './syncedTables';

export type ChangeKind = 'insert' | 'update' | 'delete';

/** One thing that happened to a row on this computer, named by the row's uuid instead of its local id. */
export interface CapturedChange {
  seq: number;
  entity: SyncedEntity;
  uuid: string;
  kind: ChangeKind;
  changedAt: string;
}

interface ChangeRow {
  seq: number;
  entity: SyncedEntity;
  local_id: number;
  kind: ChangeKind;
  changed_at: string;
}

/**
 * Reads what the capture triggers logged and translates local ids to uuids and back. Needs
 * `installSyncSchema(db)` to have run.
 *
 * Usage:
 *   const log = new ChangeLog(db);
 *   const changes = log.readSince(lastSeenSeq);
 */
export class ChangeLog {
  constructor(private readonly db: Database.Database) {}

  /** Changes with `seq` greater than the given one, oldest first. */
  public readSince(seq: number, limit = 1000): CapturedChange[] {
    const rows = this.db
      .prepare('SELECT seq, entity, local_id, kind, changed_at FROM sync_changes WHERE seq > ? ORDER BY seq LIMIT ?')
      .all(seq, limit) as ChangeRow[];
    return rows.map((row) => ({
      seq: row.seq,
      entity: row.entity,
      uuid: this.uuidOf(row.entity, row.local_id),
      kind: row.kind,
      changedAt: row.changed_at,
    }));
  }

  public latestSeq(): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM sync_changes').get() as { seq: number };
    return row.seq;
  }

  /** The uuid of a row, created on first use (rows made after sync was enabled have none yet). */
  public uuidOf(entity: SyncedEntity, localId: number): string {
    syncedTable(entity);
    const found = this.db
      .prepare('SELECT uuid FROM sync_ids WHERE entity = ? AND local_id = ?')
      .get(entity, localId) as { uuid: string } | undefined;
    if (found) return found.uuid;
    const uuid = randomUUID();
    this.db.prepare('INSERT INTO sync_ids (entity, local_id, uuid) VALUES (?, ?, ?)').run(entity, localId, uuid);
    return uuid;
  }

  /** The local id behind a uuid, or undefined when this computer has never seen it. */
  public localIdOf(entity: SyncedEntity, uuid: string): number | undefined {
    syncedTable(entity);
    const found = this.db.prepare('SELECT local_id FROM sync_ids WHERE entity = ? AND uuid = ?').get(entity, uuid) as
      | { local_id: number }
      | undefined;
    return found?.local_id;
  }

  /** Records that a row of this computer is the one a remote device calls `uuid`. */
  public bindUuid(entity: SyncedEntity, localId: number, uuid: string): void {
    syncedTable(entity);
    this.db
      .prepare('INSERT OR REPLACE INTO sync_ids (entity, local_id, uuid) VALUES (?, ?, ?)')
      .run(entity, localId, uuid);
  }

  /**
   * Runs `write` with capture switched off, so changes that come from a remote device are not sent back to it as
   * if the user had made them here. Capture is always switched back on, even if `write` throws.
   */
  public whileApplying<T>(write: () => T): T {
    const setApplying = this.db.prepare('UPDATE sync_state SET applying = ? WHERE id = 1');
    setApplying.run(1);
    try {
      return write();
    } finally {
      setApplying.run(0);
    }
  }
}

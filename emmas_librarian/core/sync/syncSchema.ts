import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { SYNCED_TABLES, type SyncedTable } from './syncedTables';

/**
 * Side tables of the sync layer. They sit next to the library instead of inside its tables, so enabling sync
 * changes no existing column (the 1.2.0 release was pulled over a migration, issue #22).
 *
 * - sync_ids: the uuid of each row. A uuid outlives its row: that is what turns a delete into a tombstone.
 * - sync_changes: what changed on this computer, appended by triggers, read in order by `seq`.
 * - sync_state.applying: 1 while the sync layer itself writes, so its writes are not logged as local changes.
 */
const SYNC_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS sync_ids (
    entity TEXT NOT NULL,
    local_id INTEGER NOT NULL,
    uuid TEXT NOT NULL UNIQUE,
    PRIMARY KEY (entity, local_id)
  );
  CREATE TABLE IF NOT EXISTS sync_changes (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,
    local_id INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('insert', 'update', 'delete')),
    changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    applying INTEGER NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO sync_state (id, applying) VALUES (1, 0);
`;

const NOT_APPLYING = '(SELECT applying FROM sync_state WHERE id = 1) = 0';

function triggerSql(table: string, suffix: string, event: string, rowRef: 'NEW' | 'OLD', kind: string): string {
  return `
    CREATE TRIGGER IF NOT EXISTS sync_${table}_${suffix} AFTER ${event} ON ${table}
    WHEN ${NOT_APPLYING}
    BEGIN
      INSERT INTO sync_changes (entity, local_id, kind) VALUES ('${table}', ${rowRef}.id, '${kind}');
    END;`;
}

function captureTriggersSql(table: SyncedTable): string {
  const name = table.entity;
  return [
    triggerSql(name, 'ai', 'INSERT', 'NEW', 'insert'),
    triggerSql(name, 'au', 'UPDATE', 'NEW', 'update'),
    triggerSql(name, 'ad', 'DELETE', 'OLD', 'delete'),
  ].join('\n');
}

/** Gives a uuid to every row of the table that has none yet (rows that existed before sync was enabled). */
function assignMissingUuids(db: Database.Database, table: SyncedTable): void {
  const missing = db
    .prepare(`SELECT id FROM ${table.entity} WHERE id NOT IN (SELECT local_id FROM sync_ids WHERE entity = ?)`)
    .all(table.entity) as { id: number }[];
  const insert = db.prepare('INSERT INTO sync_ids (entity, local_id, uuid) VALUES (?, ?, ?)');
  for (const row of missing) insert.run(table.entity, row.id, randomUUID());
}

/**
 * Turns on change capture for the synced tables. Safe to call on every start: every step is idempotent.
 *
 * @example installSyncSchema(db); // rows get uuids; later writes to `articles` land in sync_changes
 */
export function installSyncSchema(db: Database.Database): void {
  db.transaction(() => {
    db.exec(SYNC_TABLES_SQL);
    for (const table of SYNCED_TABLES) {
      db.exec(captureTriggersSql(table));
      assignMissingUuids(db, table);
    }
  })();
}

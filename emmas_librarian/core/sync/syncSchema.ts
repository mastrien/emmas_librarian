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
 * - sync_pending_ops: what a phone sent for a synced project, waiting for the user to confirm it on the desktop
 *   (the dry run). Nothing here touches the library until it is applied.
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
  CREATE TABLE IF NOT EXISTS sync_pending_ops (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    op_id TEXT NOT NULL UNIQUE,
    device_id TEXT NOT NULL,
    entity TEXT NOT NULL,
    uuid TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('insert', 'update', 'delete')),
    fields_json TEXT,
    changed_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected', 'skipped')),
    skip_reason TEXT
  );
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

/** Whether the table keeps a trash flag (`deleted_at`); not every synced table does. */
function hasTrashColumn(db: Database.Database, table: SyncedTable): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table.entity})`).all() as { name: string }[];
  return columns.some((column) => column.name === 'deleted_at');
}

/**
 * Gives a uuid to every row of the table that has none yet (rows that existed before sync was enabled) and logs
 * each of them as an `insert`, exactly as the capture trigger would have. Without that entry the phone would
 * never receive the library that was already there: the endpoint only reads `sync_changes`.
 *
 * Rows in the trash (`deleted_at` set) get a uuid but no entry: the phone never knew them and must not show
 * them. If one is restored later, the `update` the trigger logs then brings it. Only rows without a uuid are
 * touched, so a second install adds nothing.
 */
function assignMissingUuids(db: Database.Database, table: SyncedTable): void {
  // A row made after the triggers exist already has its own log entry (its uuid is only minted on first read).
  const notTrashed = hasTrashColumn(db, table) ? 'deleted_at IS NULL' : '1 = 1';
  const alive = `${notTrashed} AND id NOT IN (SELECT local_id FROM sync_changes WHERE entity = '${table.entity}')`;
  const missing = db
    .prepare(
      `SELECT id, ${alive} AS alive FROM ${table.entity}
       WHERE id NOT IN (SELECT local_id FROM sync_ids WHERE entity = ?) ORDER BY id`,
    )
    .all(table.entity) as { id: number; alive: number }[];
  const insertId = db.prepare('INSERT INTO sync_ids (entity, local_id, uuid) VALUES (?, ?, ?)');
  const logInsert = db.prepare("INSERT INTO sync_changes (entity, local_id, kind) VALUES (?, ?, 'insert')");
  for (const row of missing) {
    insertId.run(table.entity, row.id, randomUUID());
    if (row.alive) logInsert.run(table.entity, row.id);
  }
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

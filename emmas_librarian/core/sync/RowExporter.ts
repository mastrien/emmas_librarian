import type Database from 'better-sqlite3';
import type { ChangeLog } from './ChangeLog';
import type { FieldValue, RowFields } from './operations';
import { syncedTable, type SyncedEntity } from './syncedTables';

/**
 * Reads a synced row in the shape a phone receives: no local id, no file paths of this computer, and every
 * reference to another synced row replaced by that row's uuid.
 *
 * Usage:
 *   const fields = new RowExporter(db, log).exportRow('articles', 12); // { project_id: '3f2…', title: '…' }
 */
export class RowExporter {
  constructor(
    private readonly db: Database.Database,
    private readonly log: ChangeLog,
  ) {}

  /** The row's fields, or null when the row no longer exists. */
  public exportRow(entity: SyncedEntity, localId: number): RowFields | null {
    const table = syncedTable(entity);
    const row = this.db.prepare(`SELECT * FROM ${entity} WHERE id = ?`).get(localId) as RowFields | undefined;
    if (!row) return null;
    const fields: RowFields = {};
    for (const [column, value] of Object.entries(row)) {
      if (column === 'id' || table.localOnlyColumns.includes(column)) continue;
      const parent = table.parents.find((candidate) => candidate.column === column);
      fields[column] = parent ? this.parentUuid(parent.parent, value) : value;
    }
    return fields;
  }

  private parentUuid(parent: SyncedEntity, value: FieldValue): FieldValue {
    if (value === null) return null;
    return this.log.uuidOf(parent, Number(value));
  }
}

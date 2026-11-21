import type Database from 'better-sqlite3';
import type { ChangeLog } from './ChangeLog';
import type { RowFields, SyncOperation } from './operations';
import { syncedTable, type SyncedEntity } from './syncedTables';

export type ApplyOutcome = { status: 'applied' } | { status: 'skipped'; reason: string };

const skipped = (reason: string): ApplyOutcome => ({ status: 'skipped', reason });
const APPLIED: ApplyOutcome = { status: 'applied' };

/**
 * Writes one confirmed phone operation into the library. Call it only inside a transaction and inside
 * `ChangeLog.whileApplying`, which `PendingChangeStore.apply` does.
 *
 * Rules the plan fixed (2026-11-21):
 * - a delete of a table that has `deleted_at` goes to the trash instead of dropping the row;
 * - a diary page that already exists keeps its old text in `project_diary_history` and takes the new one.
 */
export class OperationApplier {
  constructor(
    private readonly db: Database.Database,
    private readonly log: ChangeLog,
  ) {}

  public apply(operation: SyncOperation): ApplyOutcome {
    try {
      return this.applyUnchecked(operation);
    } catch (error) {
      return skipped(error instanceof Error ? error.message : String(error));
    }
  }

  private applyUnchecked(operation: SyncOperation): ApplyOutcome {
    const localId = this.log.localIdOf(operation.entity, operation.uuid);
    if (operation.kind === 'insert') return this.insert(operation, localId);
    if (localId === undefined) return skipped(`${operation.entity} ${operation.uuid} does not exist on this computer`);
    return operation.kind === 'delete' ? this.remove(operation.entity, localId) : this.update(operation, localId);
  }

  private insert(operation: SyncOperation, existingId: number | undefined): ApplyOutcome {
    if (existingId !== undefined) return skipped(`${operation.entity} ${operation.uuid} was already created`);
    const fields = this.resolveParents(operation);
    if (typeof fields === 'string') return skipped(fields);
    if (operation.entity === 'project_diary' && this.keepDiaryHistory(fields))
      return this.finishDiaryUpdate(operation, fields);
    const columns = Object.keys(fields);
    const marks = columns.map(() => '?').join(', ');
    const result = this.db
      .prepare(`INSERT INTO ${operation.entity} (${columns.join(', ')}) VALUES (${marks})`)
      .run(...Object.values(fields));
    this.log.bindUuid(operation.entity, Number(result.lastInsertRowid), operation.uuid);
    return APPLIED;
  }

  private update(operation: SyncOperation, localId: number): ApplyOutcome {
    const fields = this.resolveParents(operation);
    if (typeof fields === 'string') return skipped(fields);
    const assignments = Object.keys(fields)
      .map((column) => `${column} = ?`)
      .join(', ');
    this.db
      .prepare(`UPDATE ${operation.entity} SET ${assignments} WHERE id = ?`)
      .run(...Object.values(fields), localId);
    return APPLIED;
  }

  private remove(entity: SyncedEntity, localId: number): ApplyOutcome {
    const hasTrash = (this.db.pragma(`table_info(${entity})`) as { name: string }[]).some(
      (c) => c.name === 'deleted_at',
    );
    const sql = hasTrash
      ? `UPDATE ${entity} SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`
      : `DELETE FROM ${entity} WHERE id = ?`;
    this.db.prepare(sql).run(localId);
    return APPLIED;
  }

  /** The fields with every parent uuid turned into a local id, or a message saying which parent is unknown. */
  private resolveParents(operation: SyncOperation): RowFields | string {
    const fields: RowFields = { ...operation.fields };
    for (const { column, parent } of syncedTable(operation.entity).parents) {
      const value = fields[column];
      if (value === undefined || value === null) continue;
      const localId = this.log.localIdOf(parent, String(value));
      if (localId === undefined)
        return `${column} points to ${parent} ${String(value)}, which this computer does not have`;
      fields[column] = localId;
    }
    return fields;
  }

  /** True when a diary page already exists for that project and day, after saving its text to the history. */
  private keepDiaryHistory(fields: RowFields): boolean {
    const found = this.db
      .prepare('SELECT id, content FROM project_diary WHERE project_id = ? AND entry_date = ?')
      .get(fields.project_id, fields.entry_date) as { id: number; content: string } | undefined;
    if (!found) return false;
    this.db
      .prepare('INSERT INTO project_diary_history (project_id, entry_date, content) VALUES (?, ?, ?)')
      .run(fields.project_id, fields.entry_date, found.content);
    return true;
  }

  private finishDiaryUpdate(operation: SyncOperation, fields: RowFields): ApplyOutcome {
    this.db
      .prepare('UPDATE project_diary SET content = ? WHERE project_id = ? AND entry_date = ?')
      .run(fields.content, fields.project_id, fields.entry_date);
    const row = this.db
      .prepare('SELECT id FROM project_diary WHERE project_id = ? AND entry_date = ?')
      .get(fields.project_id, fields.entry_date) as { id: number };
    this.log.bindUuid('project_diary', row.id, operation.uuid);
    return APPLIED;
  }
}

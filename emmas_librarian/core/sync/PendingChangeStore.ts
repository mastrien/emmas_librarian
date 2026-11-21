import type Database from 'better-sqlite3';
import type { ChangeLog } from './ChangeLog';
import { OperationApplier, type ApplyOutcome } from './OperationApplier';
import { parseOperation } from './operationParsing';
import type { RowFields, SyncOperation } from './operations';
import type { RowExporter } from './RowExporter';

export type PendingStatus = 'pending' | 'applied' | 'rejected' | 'skipped';

/** A staged phone change with the row as it is now on this computer, for the review screen. */
export interface PendingChange {
  operation: SyncOperation;
  /** The row today on this computer, or null for an insert or a row that is gone. */
  current: RowFields | null;
}

/** What happened to a change the phone sent; the phone undoes the ones that were not applied. */
export interface DecidedChange {
  opId: string;
  status: Exclude<PendingStatus, 'pending'>;
  reason: string | null;
}

interface PendingRow {
  op_id: string;
  device_id: string;
  entity: SyncOperation['entity'];
  uuid: string;
  kind: SyncOperation['kind'];
  fields_json: string | null;
  changed_at: string;
}

/**
 * The dry run: changes a phone made to a synced project wait here until the user confirms them on the computer
 * (plan 2026-11-21). Staging is idempotent by `opId`, applying is all-or-nothing per call, and a rejected change
 * is reported back so the phone undoes it.
 *
 * Usage:
 *   const store = new PendingChangeStore(db, log, exporter);
 *   store.stage(phoneOperations);
 *   store.apply(store.listPending().map((change) => change.operation.opId));
 */
export class PendingChangeStore {
  private readonly applier: OperationApplier;

  constructor(
    private readonly db: Database.Database,
    private readonly log: ChangeLog,
    private readonly exporter: RowExporter,
  ) {
    this.applier = new OperationApplier(db, log);
  }

  /** Validates and stores operations; returns how many were new (a repeated opId is ignored). */
  public stage(rawOperations: unknown[]): number {
    const operations = rawOperations.map((raw) => parseOperation(this.db, raw));
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO sync_pending_ops (op_id, device_id, entity, uuid, kind, fields_json, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    return this.db.transaction(() => operations.reduce((added, op) => added + insert.run(...rowOf(op)).changes, 0))();
  }

  public listPending(): PendingChange[] {
    return this.rowsWithStatus('pending').map((row) => {
      const operation = toOperation(row);
      return { operation, current: this.currentRowOf(operation) };
    });
  }

  /**
   * Applies the chosen changes in the order they were staged, all inside one transaction. A change that no
   * longer fits (its row is gone, its parent is unknown) is marked skipped and does not stop the others.
   */
  public apply(opIds: string[]): DecidedChange[] {
    const chosen = this.rowsWithStatus('pending').filter((row) => opIds.includes(row.op_id));
    return this.db.transaction(() => this.log.whileApplying(() => chosen.map((row) => this.applyOne(row))))();
  }

  /** Marks the chosen changes as rejected; the library is untouched. */
  public reject(opIds: string[]): DecidedChange[] {
    const mark = this.db.prepare(
      "UPDATE sync_pending_ops SET status = 'rejected' WHERE op_id = ? AND status = 'pending'",
    );
    return this.db.transaction(() =>
      opIds
        .filter((opId) => mark.run(opId).changes > 0)
        .map((opId) => ({ opId, status: 'rejected' as const, reason: null })),
    )();
  }

  /** Everything already decided for a device, for the next sync to tell the phone. */
  public decidedFor(deviceId: string): DecidedChange[] {
    const rows = this.db
      .prepare(
        "SELECT op_id, status, skip_reason FROM sync_pending_ops WHERE device_id = ? AND status != 'pending' ORDER BY seq",
      )
      .all(deviceId) as { op_id: string; status: DecidedChange['status']; skip_reason: string | null }[];
    return rows.map((row) => ({ opId: row.op_id, status: row.status, reason: row.skip_reason }));
  }

  private applyOne(row: PendingRow): DecidedChange {
    const outcome: ApplyOutcome = this.applier.apply(toOperation(row));
    const status = outcome.status;
    const reason = outcome.status === 'skipped' ? outcome.reason : null;
    this.db
      .prepare('UPDATE sync_pending_ops SET status = ?, skip_reason = ? WHERE op_id = ?')
      .run(status, reason, row.op_id);
    return { opId: row.op_id, status, reason };
  }

  private rowsWithStatus(status: PendingStatus): PendingRow[] {
    return this.db
      .prepare(
        'SELECT op_id, device_id, entity, uuid, kind, fields_json, changed_at FROM sync_pending_ops WHERE status = ? ORDER BY seq',
      )
      .all(status) as PendingRow[];
  }

  private currentRowOf(operation: SyncOperation): RowFields | null {
    const localId = this.log.localIdOf(operation.entity, operation.uuid);
    return localId === undefined ? null : this.exporter.exportRow(operation.entity, localId);
  }
}

function rowOf(op: SyncOperation): (string | null)[] {
  const fields = op.fields === null ? null : JSON.stringify(op.fields);
  return [op.opId, op.deviceId, op.entity, op.uuid, op.kind, fields, op.changedAt];
}

function toOperation(row: PendingRow): SyncOperation {
  const fields = row.fields_json === null ? null : (JSON.parse(row.fields_json) as RowFields);
  return {
    opId: row.op_id,
    deviceId: row.device_id,
    entity: row.entity,
    uuid: row.uuid,
    kind: row.kind,
    fields,
    changedAt: row.changed_at,
  };
}

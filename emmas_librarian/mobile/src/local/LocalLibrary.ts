import type { ChangeKind } from '../../../core/sync/ChangeLog';
import type { RowFields, SyncOperation } from '../../../core/sync/operations';
import { syncedTable, type SyncedEntity } from '../../../core/sync/syncedTables';
import { emptyState, type LibraryState, type LocalRow, type OutboxEntry, type UndoStep } from './libraryState';
import { findByUuid, originOf } from './rowTree';

/** What the library needs from the outside, so tests can fix the time and the ids. */
export interface LibraryClock {
  now(): string;
  newUuid(): string;
}

/** Rows of these tables go to the trash (`deleted_at`) on the computer instead of vanishing. */
const SOFT_DELETE: readonly SyncedEntity[] = ['projects', 'articles', 'annotations'];

function wireFields(row: LocalRow): RowFields {
  const { id: _id, uuid: _uuid, ...fields } = row;
  return fields;
}

/**
 * The phone's copy of the library and the rules for changing it (plan 2026-11-21).
 *
 * - Changes from the computer are applied as they come (`applyRemote`).
 * - A change the user makes on a project that came from the computer is also queued in the outbox; the computer
 *   decides (dry run), and `undo` puts the row back when it says no.
 * - A project made on the phone ("own") is never queued: it exists only here.
 *
 * Usage:
 *   const library = new LocalLibrary(state, clock, () => storage.save(state));
 *   const diary = library.create('project_diary', { project_id: projectUuid, entry_date: '2026-11-21', content: 'x' });
 */
export class LocalLibrary {
  constructor(
    public readonly state: LibraryState,
    private readonly clock: LibraryClock,
    private readonly onChange: () => void = () => undefined,
  ) {}

  public static empty(deviceId: string, clock: LibraryClock): LocalLibrary {
    return new LocalLibrary(emptyState(deviceId), clock);
  }

  public rows(entity: SyncedEntity): LocalRow[] {
    return this.state.rows[entity];
  }

  public find(entity: SyncedEntity, uuid: string): LocalRow | undefined {
    return findByUuid(this.state, entity, uuid);
  }

  /** A project that lives only on this phone. */
  public createOwnProject(name: string): LocalRow {
    const row = this.insertRow('projects', { name, created_at: this.clock.now(), deleted_at: null });
    this.state.origins[row.uuid] = 'own';
    this.onChange();
    return row;
  }

  public create(entity: SyncedEntity, fields: RowFields): LocalRow {
    const row = this.insertRow(entity, fields);
    this.queue(entity, row, 'insert', { action: 'remove', entity, uuid: row.uuid });
    this.onChange();
    return row;
  }

  public update(entity: SyncedEntity, uuid: string, patch: RowFields): LocalRow {
    const row = this.require(entity, uuid);
    const before = { ...row };
    Object.assign(row, patch);
    this.queue(entity, row, 'update', { action: 'restore', entity, row: before });
    this.onChange();
    return row;
  }

  public remove(entity: SyncedEntity, uuid: string): void {
    const row = this.require(entity, uuid);
    const before = { ...row };
    if (SOFT_DELETE.includes(entity)) row.deleted_at = this.clock.now();
    else this.state.rows[entity] = this.state.rows[entity].filter((candidate) => candidate.uuid !== uuid);
    this.queue(entity, before, 'delete', { action: 'restore', entity, row: before });
    this.onChange();
  }

  /** What to send to the computer: everything it has not decided on yet. Sending again is harmless (same opIds). */
  public pendingOperations(): SyncOperation[] {
    return this.state.outbox.map((entry) => entry.operation);
  }

  public hasPending(): boolean {
    return this.state.outbox.length > 0;
  }

  /** The computer applied these: nothing to undo, nothing more to send. */
  public confirm(opIds: string[]): void {
    this.state.outbox = this.state.outbox.filter((entry) => !opIds.includes(entry.operation.opId));
    this.state.processed.push(...opIds);
    this.onChange();
  }

  /** The computer refused these: put the rows back, newest change first so each step undoes the right state. */
  public undo(opIds: string[]): void {
    const chosen = this.state.outbox.filter((entry) => opIds.includes(entry.operation.opId)).reverse();
    for (const entry of chosen) this.revert(entry.undo);
    this.confirm(opIds);
  }

  /** The decisions already processed, handed over once to be told to the computer. */
  public takeProcessed(): string[] {
    return [...this.state.processed];
  }

  public forgetProcessed(opIds: string[]): void {
    this.state.processed = this.state.processed.filter((id) => !opIds.includes(id));
    this.onChange();
  }

  /** Applies changes that came from the computer. They are never queued back. */
  public applyRemote(operations: SyncOperation[]): void {
    for (const operation of operations) this.applyOne(operation);
    this.onChange();
  }

  public setCursor(cursor: number): void {
    this.state.cursor = cursor;
    this.onChange();
  }

  private applyOne(operation: SyncOperation): void {
    const existing = this.find(operation.entity, operation.uuid);
    if (operation.kind === 'delete') {
      this.state.rows[operation.entity] = this.state.rows[operation.entity].filter(
        (row) => row.uuid !== operation.uuid,
      );
    } else if (existing) {
      Object.assign(existing, operation.fields);
    } else {
      this.insertRow(operation.entity, operation.fields ?? {}, operation.uuid);
    }
  }

  private insertRow(entity: SyncedEntity, fields: RowFields, uuid = this.clock.newUuid()): LocalRow {
    syncedTable(entity);
    const id = this.state.nextId[entity];
    this.state.nextId[entity] = id + 1;
    const row: LocalRow = { ...fields, id, uuid };
    this.state.rows[entity].push(row);
    return row;
  }

  private queue(entity: SyncedEntity, row: LocalRow, kind: ChangeKind, undo: UndoStep): void {
    if (originOf(this.state, entity, row) === 'own') return;
    const fields = kind === 'delete' ? null : wireFields(row);
    const operation: SyncOperation = {
      opId: this.clock.newUuid(),
      deviceId: this.state.deviceId,
      entity,
      uuid: row.uuid,
      kind,
      fields,
      changedAt: this.clock.now(),
    };
    const entry: OutboxEntry = { operation, undo };
    this.state.outbox.push(entry);
  }

  private revert(step: UndoStep): void {
    if (step.action === 'remove') {
      this.state.rows[step.entity] = this.state.rows[step.entity].filter((row) => row.uuid !== step.uuid);
      return;
    }
    const current = this.find(step.entity, step.row.uuid);
    if (current) Object.assign(current, step.row);
    else this.state.rows[step.entity].push({ ...step.row });
  }

  private require(entity: SyncedEntity, uuid: string): LocalRow {
    const row = this.find(entity, uuid);
    if (row) return row;
    throw new Error(`No ${entity} row with uuid "${uuid}" on this phone`);
  }
}

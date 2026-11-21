import type Database from 'better-sqlite3';
import type { ChangeKind } from './ChangeLog';
import type { FieldValue, RowFields, SyncOperation } from './operations';
import { syncedTable, type SyncedEntity } from './syncedTables';

const KINDS: readonly ChangeKind[] = ['insert', 'update', 'delete'];

interface ColumnRow {
  name: string;
}

/** The columns a phone may write on a synced table: all of them except the id and the local-only ones. */
export function writableColumns(db: Database.Database, entity: SyncedEntity): string[] {
  const table = syncedTable(entity);
  const columns = db.pragma(`table_info(${entity})`) as ColumnRow[];
  return columns.map((column) => column.name).filter((name) => name !== 'id' && !table.localOnlyColumns.includes(name));
}

function requireText(value: unknown, field: string): string {
  if (typeof value === 'string' && value.length > 0) return value;
  throw new Error(`Operation field "${field}" must be a non-empty string, got ${JSON.stringify(value)}`);
}

function requireFieldValue(value: unknown, column: string): FieldValue {
  if (value === null || typeof value === 'string' || typeof value === 'number') return value;
  throw new Error(`Operation column "${column}" must be a string, number or null, got ${JSON.stringify(value)}`);
}

function parseFields(db: Database.Database, entity: SyncedEntity, kind: ChangeKind, raw: unknown): RowFields | null {
  if (kind === 'delete') return null;
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Operation of kind "${kind}" needs a fields object, got ${JSON.stringify(raw)}`);
  }
  const allowed = writableColumns(db, entity);
  const fields: RowFields = {};
  for (const [column, value] of Object.entries(raw)) {
    if (!allowed.includes(column)) {
      throw new Error(`Column "${column}" is not writable on ${entity}; expected one of: ${allowed.join(', ')}`);
    }
    fields[column] = requireFieldValue(value, column);
  }
  return fields;
}

/**
 * Checks an operation that arrived from outside (a decrypted phone message) and returns it typed.
 * Nothing from the message reaches SQL before this accepts it.
 *
 * @example parseOperation(db, { opId: 'a', deviceId: 'p', entity: 'projects', uuid: 'u', kind: 'delete', fields: null, changedAt: '…' })
 * @throws Error naming the offending value and what was expected
 */
export function parseOperation(db: Database.Database, raw: unknown): SyncOperation {
  if (typeof raw !== 'object' || raw === null)
    throw new Error(`Operation must be an object, got ${JSON.stringify(raw)}`);
  const input = raw as { [key: string]: unknown };
  const entity = syncedTable(requireText(input.entity, 'entity')).entity;
  const kind = KINDS.find((candidate) => candidate === input.kind);
  if (!kind) throw new Error(`Operation kind must be one of ${KINDS.join(', ')}, got ${JSON.stringify(input.kind)}`);
  return {
    opId: requireText(input.opId, 'opId'),
    deviceId: requireText(input.deviceId, 'deviceId'),
    entity,
    uuid: requireText(input.uuid, 'uuid'),
    kind,
    fields: parseFields(db, entity, kind, input.fields),
    changedAt: requireText(input.changedAt, 'changedAt'),
  };
}

import type { FieldValue, RowFields, SyncOperation } from '../../../core/sync/operations';
import { SYNCED_TABLES, type SyncedEntity } from '../../../core/sync/syncedTables';

/** Where a project came from. Only the computer's projects ("synced") are mirrored; "own" ones live on the phone. */
export type ProjectOrigin = 'synced' | 'own';

/**
 * A row as the phone keeps it: the wire columns, plus a local numeric `id` for the screens. Columns that point
 * to another row hold that row's uuid (the wire form), so a change can be sent without translating.
 */
export interface LocalRow extends RowFields {
  id: number;
  uuid: string;
}

/** How to put things back when the computer rejects a change the phone made. */
export type UndoStep =
  | { action: 'remove'; entity: SyncedEntity; uuid: string }
  | { action: 'restore'; entity: SyncedEntity; row: LocalRow };

export interface OutboxEntry {
  operation: SyncOperation;
  undo: UndoStep;
}

export type RowsByEntity = { [entity in SyncedEntity]: LocalRow[] };

/** Everything the phone stores about the library; one JSON document, saved after each change. */
export interface LibraryState {
  version: 1;
  deviceId: string;
  /** Position in the computer's change log that this phone already has. */
  cursor: number;
  nextId: { [entity in SyncedEntity]: number };
  rows: RowsByEntity;
  /** Project uuid → origin; a project not listed here came from the computer. */
  origins: { [projectUuid: string]: ProjectOrigin };
  /** Changes made on the phone that the computer has not decided on yet. */
  outbox: OutboxEntry[];
  /** Decisions already processed, to be told to the computer on the next sync. */
  processed: string[];
}

function perEntity<T>(make: () => T): { [entity in SyncedEntity]: T } {
  const result = {} as { [entity in SyncedEntity]: T };
  for (const table of SYNCED_TABLES) result[table.entity] = make();
  return result;
}

export function emptyState(deviceId: string): LibraryState {
  return {
    version: 1,
    deviceId,
    cursor: 0,
    nextId: perEntity(() => 1),
    rows: perEntity(() => []),
    origins: {},
    outbox: [],
    processed: [],
  };
}

export function isFieldValue(value: unknown): value is FieldValue {
  return value === null || typeof value === 'string' || typeof value === 'number';
}

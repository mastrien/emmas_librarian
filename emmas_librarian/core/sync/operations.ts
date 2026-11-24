import type { ChangeKind } from './ChangeLog';
import type { SyncedEntity } from './syncedTables';

export type FieldValue = string | number | null;

/** Column name → value. Columns that point to another synced row hold that row's uuid, never its local id. */
export interface RowFields {
  [column: string]: FieldValue;
}

/**
 * One change as it travels between the computer and a phone. `opId` makes it idempotent: a receiver that
 * already applied (or staged) an opId ignores it, so a retry after a dropped connection is harmless.
 */
export interface SyncOperation {
  opId: string;
  deviceId: string;
  entity: SyncedEntity;
  uuid: string;
  kind: ChangeKind;
  /** The whole row after the change; null for a delete (the uuid alone is the tombstone). */
  fields: RowFields | null;
  changedAt: string;
}

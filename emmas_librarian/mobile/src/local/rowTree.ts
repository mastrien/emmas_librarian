import { syncedTable, type SyncedEntity } from '../../../core/sync/syncedTables';
import type { LibraryState, LocalRow, ProjectOrigin } from './libraryState';

function findByUuid(state: LibraryState, entity: SyncedEntity, uuid: string): LocalRow | undefined {
  return state.rows[entity].find((row) => row.uuid === uuid);
}

export { findByUuid };

/** The uuid of the project a row belongs to, following its parent columns up; null for an orphan. */
export function projectUuidOf(state: LibraryState, entity: SyncedEntity, row: LocalRow): string | null {
  if (entity === 'projects') return row.uuid;
  for (const { column, parent } of syncedTable(entity).parents) {
    const parentUuid = row[column];
    if (typeof parentUuid !== 'string') continue;
    const parentRow = findByUuid(state, parent, parentUuid);
    const found = parentRow ? projectUuidOf(state, parent, parentRow) : null;
    if (found) return found;
  }
  return null;
}

/** Whether changes to this row must be sent to the computer: only rows of a project that came from it. */
export function originOf(state: LibraryState, entity: SyncedEntity, row: LocalRow): ProjectOrigin {
  const project = projectUuidOf(state, entity, row);
  return (project && state.origins[project]) || 'synced';
}

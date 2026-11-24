import { syncedTable, type SyncedEntity } from '../../../core/sync/syncedTables';
import type { LocalLibrary } from './LocalLibrary';
import type { LocalRow } from './libraryState';

/** Rows the screens may see: not in the trash. */
export const isLive = (row: LocalRow): boolean => !row.deleted_at;

/**
 * A row as the screens know it: the numeric `id`, and every reference to another row as that row's numeric id
 * (the uuids are the wire form and stay inside the sync layer).
 *
 * @example typed(library, 'articles', row) // { id: 3, project_id: 1, title: '…' }
 */
export function typed<T>(library: LocalLibrary, entity: SyncedEntity, row: LocalRow): T {
  const { uuid: _uuid, ...columns } = row;
  const out: { [column: string]: unknown } = { ...columns };
  for (const { column, parent } of syncedTable(entity).parents) {
    const value = row[column];
    out[column] = typeof value === 'string' ? (library.find(parent, value)?.id ?? null) : null;
  }
  return out as T;
}

export function rowById(library: LocalLibrary, entity: SyncedEntity, id: number): LocalRow {
  const row = library.rows(entity).find((candidate) => candidate.id === id);
  if (row) return row;
  throw new Error(`No ${entity} with id ${id} on this phone`);
}

/** The rows of `entity` whose reference column points at the row with this numeric id. */
export function childrenOf(
  library: LocalLibrary,
  entity: SyncedEntity,
  column: string,
  parentUuid: string,
): LocalRow[] {
  return library.rows(entity).filter((row) => row[column] === parentUuid && isLive(row));
}

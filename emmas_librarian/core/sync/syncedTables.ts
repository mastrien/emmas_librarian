/**
 * The tables a paired phone can see and change (docs/planos/2026-11-21_mobile_robusto.md, section 2).
 * Each entry is also the wire name of the entity. Anything not listed here (settings, API keys, vectors, chat,
 * trash) never leaves the desktop.
 */
export type SyncedEntity =
  | 'projects'
  | 'articles'
  | 'annotations'
  | 'highlights'
  | 'project_diary'
  | 'project_documents';

/** A column holding the local id of a row in another synced table; on the wire it becomes that row's uuid. */
export interface ParentColumn {
  column: string;
  parent: SyncedEntity;
}

export interface SyncedTable {
  entity: SyncedEntity;
  parents: readonly ParentColumn[];
  /** Columns that describe this computer (file paths) and so are never sent to a phone. */
  localOnlyColumns: readonly string[];
}

export const SYNCED_TABLES: readonly SyncedTable[] = [
  { entity: 'projects', parents: [], localOnlyColumns: [] },
  {
    entity: 'articles',
    parents: [{ column: 'project_id', parent: 'projects' }],
    localOnlyColumns: ['local_file_path'],
  },
  {
    entity: 'annotations',
    parents: [
      { column: 'article_id', parent: 'articles' },
      { column: 'highlight_id', parent: 'highlights' },
    ],
    localOnlyColumns: [],
  },
  {
    entity: 'highlights',
    parents: [
      { column: 'article_id', parent: 'articles' },
      { column: 'annotation_id', parent: 'annotations' },
    ],
    localOnlyColumns: [],
  },
  { entity: 'project_diary', parents: [{ column: 'project_id', parent: 'projects' }], localOnlyColumns: [] },
  {
    entity: 'project_documents',
    parents: [{ column: 'project_id', parent: 'projects' }],
    localOnlyColumns: ['local_file_path'],
  },
];

/**
 * The registry entry of an entity name received from outside (a phone, a file).
 *
 * @example syncedTable('articles').parents // [{ column: 'project_id', parent: 'projects' }]
 * @throws Error naming the offending value and the accepted ones
 */
export function syncedTable(entity: string): SyncedTable {
  const found = SYNCED_TABLES.find((table) => table.entity === entity);
  if (found) return found;
  const accepted = SYNCED_TABLES.map((table) => table.entity).join(', ');
  throw new Error(`Unknown synced entity "${entity}"; expected one of: ${accepted}`);
}

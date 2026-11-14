import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import type { StorageDirs } from './backupMerge';

/** Columns holding the absolute path of a file kept in the app's storage, and the folder it lives in. */
const STORED_PATH_COLUMNS: { table: string; column: string; folder: keyof StorageDirs }[] = [
  { table: 'articles', column: 'local_file_path', folder: 'pdfs' },
  { table: 'pdf_files', column: 'file_path', folder: 'pdfs' },
  { table: 'project_documents', column: 'local_file_path', folder: 'documents' },
];

/**
 * Points stored-file paths at this installation's storage folders. The database keeps absolute paths, so a
 * backup restored on another computer or user account still pointed at the old userData folder.
 * A path that still exists is kept; a missing one moves to the file with the same name in `storage`, if any.
 * Returns how many rows changed.
 *
 * Usage:
 *   rebaseStoredPaths(restoredDb, { pdfs: '/userData/storage/pdfs', documents: '/userData/storage/project_documents' });
 */
export function rebaseStoredPaths(db: Database.Database, storage: StorageDirs): number {
  return db.transaction(() =>
    STORED_PATH_COLUMNS.reduce(
      (changed, { table, column, folder }) => changed + rebaseColumn(db, table, column, storage[folder]),
      0,
    ),
  )();
}

interface StoredPathRow {
  id: number;
  stored: string;
}

function rebaseColumn(db: Database.Database, table: string, column: string, dir: string): number {
  const sql = `SELECT rowid AS id, ${column} AS stored FROM ${table} WHERE ${column} IS NOT NULL`;
  const rows = db.prepare(sql).all() as StoredPathRow[];
  const update = db.prepare(`UPDATE ${table} SET ${column} = ? WHERE rowid = ?`);
  let changed = 0;
  for (const { id, stored } of rows) {
    const moved = relocatedPath(stored, dir);
    if (moved) changed += update.run(moved, id).changes;
  }
  return changed;
}

// Split on both separators: a backup made on Windows may be restored on macOS/Linux and vice versa.
function relocatedPath(stored: string, dir: string): string | null {
  if (fs.existsSync(stored)) return null;
  const candidate = path.join(dir, stored.split(/[\\/]/).pop() ?? '');
  return fs.existsSync(candidate) ? candidate : null;
}

import type Database from 'better-sqlite3';

export type SqlRow = Record<string, unknown>;

/**
 * Column names of `table` in `db`, so rows from an older or newer schema can be copied by intersection.
 *
 * Usage:
 *   const columns = tableColumns(db, 'articles');
 */
export function tableColumns(db: Database.Database, table: string): Set<string> {
  const info = db.pragma(`table_info(${table})`) as { name: string }[];
  return new Set(info.map((col) => col.name));
}

/**
 * Inserts `row` into `table`, keeping only the columns the table has and never copying `id`;
 * `overrides` replace values that must point at the new rows (project, article, ...).
 * Returns the new row id.
 *
 * Usage:
 *   const newId = copyRow(activeDb, 'articles', backupArticle, { project_id: newProjectId });
 */
export function copyRow(db: Database.Database, table: string, row: SqlRow, overrides: SqlRow = {}): number {
  const columns = tableColumns(db, table);
  const values: SqlRow = { ...row, ...overrides };
  const names = Object.keys(values).filter((name) => name !== 'id' && columns.has(name));
  const sql = `INSERT INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`;
  return Number(db.prepare(sql).run(...names.map((name) => values[name])).lastInsertRowid);
}

/**
 * Rows of `table` whose project is `projectId`, directly or through the article they belong to.
 *
 * Usage:
 *   rowsOfProject(backupDb, 'highlights', 3, 'article');
 */
export function rowsOfProject(
  db: Database.Database,
  table: string,
  projectId: number,
  via: 'project' | 'article' = 'project',
): SqlRow[] {
  const sql =
    via === 'project'
      ? `SELECT * FROM ${table} WHERE project_id = ?`
      : `SELECT t.* FROM ${table} t JOIN articles a ON t.article_id = a.id WHERE a.project_id = ?`;
  return db.prepare(sql).all(projectId) as SqlRow[];
}

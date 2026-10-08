import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { initializeSchema } from '../electron/database/schemaMigrations';
import {
  libraryTables,
  seedFullLibrary,
  writeLibraryFiles,
} from '../electron/database/__tests__/support/fullLibraryFixture';

export interface TransferReport {
  /** Tables the older schema does not have; their rows cannot exist in that version. */
  skippedTables: string[];
  /** `table.column` pairs the older schema does not have. */
  skippedColumns: string[];
}

type Row = Record<string, unknown>;

/**
 * Opens a library file with sqlite-vec loaded, as the app does (the semantic-search table needs it).
 *
 * Usage:
 *   const db = openLibrary(path.join(userData, 'emma.db'));
 */
export function openLibrary(file: string): Database.Database {
  const db = new Database(file);
  sqliteVec.load(db);
  return db;
}

/**
 * The full test library (fullLibraryFixture) in memory, with today's schema; its PDF and document
 * are written under `userData/storage`, where the app keeps them.
 *
 * Usage:
 *   const source = buildFullLibrary(userData);
 */
export function buildFullLibrary(userData: string): Database.Database {
  const db = openLibrary(':memory:');
  initializeSchema(db, () => undefined);
  seedFullLibrary(db, writeLibraryFiles(userData));
  return db;
}

/**
 * Copies every row of `source` into `target`, keeping ids, so a library created by an older version
 * holds as much of the full library as its schema allows. Rows the target already has (default
 * settings, AI models) are replaced. Tables and columns the target lacks are reported, not created.
 *
 * Usage:
 *   const report = copyLibraryInto(buildFullLibrary(userData), openLibrary(installedDbPath));
 */
export function copyLibraryInto(source: Database.Database, target: Database.Database): TransferReport {
  const report: TransferReport = { skippedTables: [], skippedColumns: [] };
  // Rows go in table by table, so a key may point at a row that is copied later.
  target.pragma('foreign_keys = OFF');
  target.transaction(() => libraryTables(source).forEach((table) => copyTable(source, target, table, report)))();
  target.pragma('foreign_keys = ON');
  return report;
}

function copyTable(source: Database.Database, target: Database.Database, table: string, report: TransferReport): void {
  if (isVirtual(source, table)) return copyVirtualTable(source, target, table);
  if (!hasTable(target, table)) {
    report.skippedTables.push(table);
    return;
  }
  const targetColumns = new Set(columnsOf(target, table));
  const columns = columnsOf(source, table).filter((column) => targetColumns.has(column));
  report.skippedColumns.push(
    ...columnsOf(source, table)
      .filter((column) => !targetColumns.has(column))
      .map((column) => `${table}.${column}`),
  );
  const quoted = columns.map((column) => `"${column}"`).join(', ');
  const insert = target.prepare(
    `INSERT OR REPLACE INTO "${table}" (${quoted}) VALUES (${columns.map(() => '?').join(', ')})`,
  );
  for (const row of source.prepare(`SELECT ${quoted} FROM "${table}"`).all() as Row[]) {
    insert.run(...columns.map((column) => row[column]));
  }
}

// vec0 tables keep their vectors by rowid; the app creates this one on first indexing, so an older
// library may not have it yet.
function copyVirtualTable(source: Database.Database, target: Database.Database, table: string): void {
  if (!hasTable(target, table)) target.exec(tableSql(source, table));
  const insert = target.prepare(`INSERT OR REPLACE INTO "${table}" (rowid, embedding) VALUES (?, ?)`);
  for (const row of source.prepare(`SELECT rowid, embedding FROM "${table}"`).all() as Row[]) {
    insert.run(BigInt(row.rowid as number), row.embedding);
  }
}

const tableSql = (db: Database.Database, table: string) =>
  (db.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get(table) as { sql: string }).sql;

const hasTable = (db: Database.Database, table: string) =>
  db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) !== undefined;

const isVirtual = (db: Database.Database, table: string) => /CREATE VIRTUAL TABLE/i.test(tableSql(db, table));

export const columnsOf = (db: Database.Database, table: string): string[] =>
  (db.pragma(`table_info("${table}")`) as { name: string }[]).map(({ name }) => name);

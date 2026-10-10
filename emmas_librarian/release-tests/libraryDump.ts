import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import { libraryTables } from '../electron/database/__tests__/support/fullLibraryFixture';
import { columnsOf } from './libraryTransfer';

export interface TableDump {
  columns: string[];
  /** Each row as a JSON array in `columns` order, sorted, so row order never matters. */
  rows: string[];
}

export interface LibraryDump {
  tables: Record<string, TableDump>;
  /** Files under userData/storage (stored PDFs, project documents), by relative path, as sha256. */
  files: Record<string, string>;
}

/**
 * Everything a library holds: every row of every table and a hash of every stored file.
 *
 * Usage:
 *   const before = dumpLibrary(openLibrary(dbPath), userData);
 */
export function dumpLibrary(db: Database.Database, userData: string): LibraryDump {
  const tables = Object.fromEntries(libraryTables(db).map((table) => [table, dumpTable(db, table)]));
  return { tables, files: hashStoredFiles(path.join(userData, 'storage')) };
}

// Virtual tables have no declared key, so their rowid is part of the data (it links the vector to
// its chunk); ordinary tables are compared on their columns, ids included.
function dumpTable(db: Database.Database, table: string): TableDump {
  const isVirtual = /CREATE VIRTUAL TABLE/i.test(
    (db.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get(table) as { sql: string }).sql,
  );
  const columns = isVirtual ? ['rowid', ...columnsOf(db, table)] : columnsOf(db, table);
  const select = columns.map((column) => (column === 'rowid' ? 'rowid' : `"${column}"`)).join(', ');
  const rows = (db.prepare(`SELECT ${select} FROM "${table}"`).raw().all() as unknown[][])
    .map((values) => JSON.stringify(values.map(comparableValue)))
    .sort();
  return { columns, rows };
}

const comparableValue = (value: unknown) =>
  Buffer.isBuffer(value) ? `hex:${value.toString('hex')}` : typeof value === 'bigint' ? Number(value) : value;

function hashStoredFiles(storageDir: string): Record<string, string> {
  if (!fs.existsSync(storageDir)) return {};
  const files = fs.readdirSync(storageDir, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
  return Object.fromEntries(
    files.map((entry) => {
      const file = path.join(entry.parentPath, entry.name);
      const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      return [path.relative(storageDir, file).split(path.sep).join('/'), hash];
    }),
  );
}

/**
 * What `before` held that `after` no longer holds unchanged: missing tables, columns, rows (a row
 * whose values changed counts as lost) and stored files. An upgrade may add tables, columns and rows.
 *
 * Usage:
 *   expect(findLostData(before, after)).toEqual([]);
 */
export function findLostData(before: LibraryDump, after: LibraryDump): string[] {
  const tableLosses = Object.entries(before.tables).flatMap(([table, dump]) =>
    lostInTable(table, dump, after.tables[table]),
  );
  const fileLosses = Object.entries(before.files)
    .filter(([file, hash]) => after.files[file] !== hash)
    .map(([file]) => `file storage/${file}: ${file in after.files ? 'changed' : 'missing'}`);
  return [...tableLosses, ...fileLosses];
}

function lostInTable(table: string, before: TableDump, after: TableDump | undefined): string[] {
  if (!after) return [`table ${table}: missing`];
  const missingColumns = before.columns.filter((column) => !after.columns.includes(column));
  if (missingColumns.length) return missingColumns.map((column) => `column ${table}.${column}: missing`);
  const remaining = rowCounts(projectRows(after, before.columns));
  const lost = before.rows.filter((row) => !takeRow(remaining, row));
  return lost.length ? [`table ${table}: ${lost.length} row(s) lost or changed, e.g. ${lost[0]}`] : [];
}

// The upgraded table's rows reduced to the columns the old one had, in the old order.
function projectRows(after: TableDump, columns: string[]): string[] {
  const positions = columns.map((column) => after.columns.indexOf(column));
  return after.rows.map((row) => {
    const values = JSON.parse(row) as unknown[];
    return JSON.stringify(positions.map((position) => values[position]));
  });
}

function rowCounts(rows: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row, (counts.get(row) ?? 0) + 1));
  return counts;
}

function takeRow(counts: Map<string, number>, row: string): boolean {
  const left = counts.get(row) ?? 0;
  if (left === 0) return false;
  counts.set(row, left - 1);
  return true;
}

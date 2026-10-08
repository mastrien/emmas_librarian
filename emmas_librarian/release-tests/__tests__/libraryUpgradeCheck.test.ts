// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import type Database from 'better-sqlite3';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeSchema } from '../../electron/database/schemaMigrations';
import { buildFullLibrary, copyLibraryInto, openLibrary } from '../libraryTransfer';
import { dumpLibrary, findLostData, type LibraryDump } from '../libraryDump';

let workDir: string;
let userData: string;
const open: Database.Database[] = [];

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-release-check-'));
  userData = path.join(workDir, 'userData');
});

afterEach(() => {
  open.splice(0).forEach((db) => db.close());
  fs.rmSync(workDir, { recursive: true, force: true });
});

/** A library file with today's schema, optionally altered to look like an older version's. */
function installedLibrary(olderSchema = ''): Database.Database {
  const db = openLibrary(path.join(workDir, `installed-${open.length}.db`));
  open.push(db);
  initializeSchema(db, () => undefined);
  if (olderSchema) db.exec(olderSchema);
  return db;
}

function fullLibrary(): Database.Database {
  const db = buildFullLibrary(userData);
  open.push(db);
  return db;
}

const count = (db: Database.Database, table: string) =>
  (db.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }).n;

describe('copyLibraryInto', () => {
  it('copies every row with its id into a library with the same schema', () => {
    const source = fullLibrary();
    const target = installedLibrary();

    const report = copyLibraryInto(source, target);

    expect(report).toEqual({ skippedTables: [], skippedColumns: [] });
    expect(findLostData(dumpLibrary(source, userData), dumpLibrary(target, userData))).toEqual([]);
  });

  it('reports what an older schema lacks and still copies the rest', () => {
    const source = fullLibrary();
    const target = installedLibrary(
      'ALTER TABLE articles DROP COLUMN ai_summary; DROP TABLE scientific_milestones; DROP TABLE scientific_venues;',
    );

    const report = copyLibraryInto(source, target);

    expect(report.skippedTables.sort()).toEqual(['scientific_milestones', 'scientific_venues']);
    expect(report.skippedColumns).toEqual(['articles.ai_summary']);
    expect(count(target, 'articles')).toBe(count(source, 'articles'));
  });

  it('creates the semantic-search table when the library has not indexed anything yet', () => {
    const target = installedLibrary();

    copyLibraryInto(fullLibrary(), target);

    expect(count(target, 'pdf_chunk_embeddings')).toBe(1);
  });

  it('keeps foreign keys valid after copying', () => {
    const target = installedLibrary();

    copyLibraryInto(fullLibrary(), target);

    expect(target.pragma('foreign_key_check')).toEqual([]);
  });
});

describe('dumpLibrary', () => {
  it('hashes stored files by their path under storage/', () => {
    const dump = dumpLibrary(fullLibrary(), userData);

    expect(Object.keys(dump.files).sort()).toEqual(['pdfs/artigo-a.pdf', 'project_documents/edital.pdf']);
  });
});

describe('findLostData', () => {
  const dump = (rows: string[], columns = ['id', 'title'], files = { 'pdfs/a.pdf': 'h1' }): LibraryDump => ({
    tables: { articles: { columns, rows } },
    files,
  });
  const before = dump(['[1,"A"]', '[2,"B"]']);

  it('finds nothing when every row and file is still there', () => {
    expect(findLostData(before, dump(['[2,"B"]', '[1,"A"]']))).toEqual([]);
  });

  it('accepts what an upgrade adds: rows, columns and tables', () => {
    const after: LibraryDump = {
      tables: {
        articles: { columns: ['id', 'title', 'novo'], rows: ['[1,"A",null]', '[2,"B",null]', '[3,"C","x"]'] },
        nova_tabela: { columns: ['id'], rows: ['[1]'] },
      },
      files: { 'pdfs/a.pdf': 'h1', 'pdfs/b.pdf': 'h2' },
    };

    expect(findLostData(before, after)).toEqual([]);
  });

  it('reports a removed row and a changed value as lost', () => {
    expect(findLostData(before, dump(['[1,"A (editado)"]']))).toEqual([
      'table articles: 2 row(s) lost or changed, e.g. [1,"A"]',
    ]);
  });

  it('counts duplicate rows, so losing one copy is reported', () => {
    expect(findLostData(dump(['[1,"A"]', '[1,"A"]']), dump(['[1,"A"]']))).toEqual([
      'table articles: 1 row(s) lost or changed, e.g. [1,"A"]',
    ]);
  });

  it('reports a missing table and a missing column', () => {
    expect(findLostData(before, { tables: {}, files: before.files })).toEqual(['table articles: missing']);
    expect(findLostData(before, dump(['[1]', '[2]'], ['id']))).toEqual(['column articles.title: missing']);
  });

  it('reports a stored file that changed or disappeared', () => {
    const twoFiles = dump(before.tables.articles.rows, undefined, { 'pdfs/a.pdf': 'h1', 'docs/d.pdf': 'h2' });

    expect(findLostData(twoFiles, dump(before.tables.articles.rows, undefined, { 'pdfs/a.pdf': 'outro' }))).toEqual([
      'file storage/pdfs/a.pdf: changed',
      'file storage/docs/d.pdf: missing',
    ]);
  });
});

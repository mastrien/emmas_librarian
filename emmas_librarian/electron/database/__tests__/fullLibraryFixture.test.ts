import fs from 'fs';
import os from 'os';
import path from 'path';
import type Database from 'better-sqlite3';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { libraryTables as libraryTablesOf, seedFullLibrary, writeLibraryFiles } from './support/fullLibraryFixture';
import { columnsDatedNow, projectContent, projectScopedTables } from './support/fullProjectFixture';

vi.mock('electron', () => ({ safeStorage: {} }));

// Guards the fixture itself: a table or column added to the schema and left empty here would let an
// upgrade or backup drop it without any test noticing.
let workDir: string;
let adapter: DatabaseAdapter;
let db: Database.Database;

beforeAll(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-full-library-'));
  adapter = new DatabaseAdapter(path.join(workDir, 'emma.db'));
  db = adapter.getDB();
  seedFullLibrary(db, writeLibraryFiles(workDir));
});

afterAll(() => {
  adapter.close();
  fs.rmSync(workDir, { recursive: true, force: true });
});

const libraryTables = () => libraryTablesOf(db);

const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;

describe('full library fixture', () => {
  it('includes the semantic-search table, which only exists after the first indexing', () => {
    expect(libraryTables()).toContain('pdf_chunk_embeddings');
  });

  it('leaves no table empty', () => {
    const empty = libraryTables().filter((table) => count(`SELECT count(*) AS n FROM "${table}"`) === 0);

    expect(empty).toEqual([]);
  });

  it('fills every column in at least one row', () => {
    const neverFilled = libraryTables().flatMap((table) =>
      (db.pragma(`table_info("${table}")`) as { name: string }[])
        .filter(({ name }) => count(`SELECT count(*) AS n FROM "${table}" WHERE "${name}" IS NOT NULL`) === 0)
        .map(({ name }) => `${table}.${name}`),
    );

    expect(neverFilled).toEqual([]);
  });

  it('has a real file behind every stored path', () => {
    const storedPaths = db
      .prepare(
        `SELECT local_file_path AS p FROM articles WHERE local_file_path IS NOT NULL
         UNION SELECT local_file_path FROM project_documents WHERE local_file_path IS NOT NULL
         UNION SELECT file_path FROM pdf_files`,
      )
      .all() as { p: string }[];

    expect(storedPaths.length).toBeGreaterThan(0);
    expect(storedPaths.filter(({ p }) => !fs.existsSync(p))).toEqual([]);
  });

  it('has every category type the UI offers', () => {
    const types = (db.prepare('SELECT DISTINCT type FROM project_categories').all() as { type: string }[])
      .map(({ type }) => type)
      .sort();

    expect(types).toEqual(['boolean', 'enum', 'multiselect', 'text']);
  });

  it('has a project, an article and a note in the trash, and a question set shared by all projects', () => {
    expect({
      projects: count('SELECT count(*) AS n FROM projects WHERE deleted_at IS NOT NULL'),
      articles: count('SELECT count(*) AS n FROM articles WHERE deleted_at IS NOT NULL'),
      notes: count('SELECT count(*) AS n FROM annotations WHERE deleted_at IS NOT NULL'),
      globalQuestionSets: count('SELECT count(*) AS n FROM question_sets WHERE project_id IS NULL'),
    }).toEqual({ projects: 1, articles: 1, notes: 1, globalQuestionSets: 1 });
  });

  it('compares every table that belongs to a project when checking copies', () => {
    // Exports and merges leave search chunks behind: AIService re-indexes an article without chunks the
    // first time an investigation needs it.
    const notCopied = new Set(['pdf_chunks']);
    const linkedToProject = libraryTables().filter((table) =>
      (db.pragma(`table_info("${table}")`) as { name: string }[]).some(({ name }) =>
        ['project_id', 'article_id', 'category_id', 'investigation_id'].includes(name),
      ),
    );

    const missing = linkedToProject.filter((table) => !projectScopedTables().includes(table) && !notCopied.has(table));

    expect(missing).toEqual([]);
  });

  describe('what projectContent compares', () => {
    const thesis = () => (db.prepare("SELECT id FROM projects WHERE name = 'Tese'").get() as { id: number }).id;

    it('gives the project rows fixed past dates, so a copy that loses them is noticed', () => {
      expect(columnsDatedNow(db, thesis())).toEqual([]);
    });

    it('compares creation and update dates', () => {
      const content = projectContent(db, thesis());

      expect(content.annotations[0]).toContain('2025-03-04 05:06:07');
      expect(content.question_sets[0]).toContain('2025-03-05 06:07:08');
    });

    it('leaves out keys and remapped files, and the project name only on projects', () => {
      const content = projectContent(db, thesis());

      expect(content.articles.join()).not.toMatch(/"local_file_path"|"project_id"|"search_id"/);
      expect(content.articles.join()).toContain('"ai_summary"');
      expect(content.projects.join()).not.toContain('"name"');
      expect(content.project_categories.join()).toContain('"name"');
    });
  });
});

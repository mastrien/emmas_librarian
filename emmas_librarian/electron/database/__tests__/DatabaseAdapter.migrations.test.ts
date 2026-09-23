import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { ArticleRepository } from '../ArticleRepository';

const loadable = vi.hoisted(() => ({ override: null as string | null }));

vi.mock('sqlite-vec', async (importOriginal) => {
  const original = await importOriginal<typeof import('sqlite-vec')>();
  return { ...original, getLoadablePath: () => loadable.override ?? original.getLoadablePath() };
});
vi.mock('electron', () => ({ safeStorage: {} }));

let workDir: string;
let dbPath: string;

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-migrations-'));
  dbPath = path.join(workDir, 'emma.db');
});

afterEach(() => {
  vi.restoreAllMocks();
  loadable.override = null;
  fs.rmSync(workDir, { recursive: true, force: true });
});

/** Opens the adapter once (running all migrations), lets the test mutate raw SQL, then closes. */
function seed(mutate: (raw: Database.Database) => void): void {
  new DatabaseAdapter(dbPath).close();
  withRawDatabase(mutate);
}

/** Runs raw SQL against the file before (or between) adapter opens; always releases the file handle. */
function withRawDatabase(mutate: (raw: Database.Database) => void): void {
  const raw = new Database(dbPath);
  try {
    mutate(raw);
  } finally {
    raw.close();
  }
}

function reopen<T>(read: (raw: Database.Database) => T): T {
  new DatabaseAdapter(dbPath).close();
  const raw = new Database(dbPath, { readonly: true });
  try {
    return read(raw);
  } finally {
    raw.close();
  }
}

const silenceConsoleError = () => vi.spyOn(console, 'error').mockImplementation(() => undefined);

describe('sqlite-vec extension loading', () => {
  it('loads the extension from app.asar.unpacked inside a packaged app', () => {
    loadable.override = path.join('C:', 'app', 'resources', 'app.asar', 'node_modules', 'sqlite-vec', 'vec0');
    const loadExtension = vi.spyOn(Database.prototype, 'loadExtension').mockImplementation(function (this: Database.Database) {
      return this;
    });

    new DatabaseAdapter(':memory:').close();

    expect(loadExtension).toHaveBeenCalledWith(path.join('C:', 'app', 'resources', 'app.asar.unpacked', 'node_modules', 'sqlite-vec', 'vec0'));
  });

  it('leaves an already unpacked path untouched', () => {
    loadable.override = path.join('C:', 'app', 'APP.ASAR.UNPACKED', 'vec0');
    const loadExtension = vi.spyOn(Database.prototype, 'loadExtension').mockImplementation(function (this: Database.Database) {
      return this;
    });

    new DatabaseAdapter(':memory:').close();

    expect(loadExtension).toHaveBeenCalledWith(loadable.override);
  });

  it('logs and keeps working when the extension cannot be loaded', () => {
    const consoleError = silenceConsoleError();
    vi.spyOn(Database.prototype, 'loadExtension').mockImplementation(() => {
      throw new Error('bad ELF');
    });

    const adapter = new DatabaseAdapter(':memory:');

    expect(consoleError).toHaveBeenCalledWith('Failed to load sqlite-vec extension', expect.objectContaining({ message: 'bad ELF' }));
    expect(adapter.getAllProjects()).toEqual([]);
    adapter.close();
  });
});

describe('is_oa / publisher backfill', () => {
  it('fills both columns from csl_json for existing articles, once', () => {
    seed((raw) => {
      raw.prepare("INSERT INTO projects (id, name) VALUES (1, 'P')").run();
      const insert = raw.prepare(
        "INSERT INTO articles (id, project_id, title, source_query, source_databases, csl_json) VALUES (?, 1, ?, 'q', '[]', ?)",
      );
      insert.run(1, 'open', JSON.stringify({ is_oa: true, publisher: 'Elsevier' }));
      insert.run(2, 'closed', JSON.stringify({ is_oa: false }));
      insert.run(3, 'unknown', JSON.stringify({}));
      insert.run(4, 'broken', '{not json');
      raw.prepare("DELETE FROM settings WHERE key = 'backfilled_is_oa_publisher'").run();
    });

    const rows = reopen((raw) => raw.prepare('SELECT id, is_oa, publisher FROM articles ORDER BY id').all());
    const flag = reopen((raw) => raw.prepare("SELECT value FROM settings WHERE key = 'backfilled_is_oa_publisher'").get());

    expect(rows).toEqual([
      { id: 1, is_oa: 1, publisher: 'Elsevier' },
      { id: 2, is_oa: 0, publisher: null },
      { id: 3, is_oa: null, publisher: null },
      { id: 4, is_oa: null, publisher: null },
    ]);
    expect(flag).toEqual({ value: 'true' });
  });
});

describe('category options backfill', () => {
  function seedLegacyCategories(): void {
    seed((raw) => {
      raw.prepare("INSERT INTO projects (id, name) VALUES (1, 'P')").run();
      const article = raw.prepare(
        "INSERT INTO articles (id, project_id, title, source_query, source_databases, csl_json) VALUES (?, 1, 't', 'q', '[]', '{}')",
      );
      [1, 2, 3].forEach((id) => article.run(id));
      const category = raw.prepare('INSERT INTO project_categories (id, project_id, name, type, options) VALUES (?, 1, ?, ?, ?)');
      category.run(10, 'Método', 'enum', 'Survey, Experimento');
      category.run(11, 'Temas', 'multiselect', 'IA,Saúde, ');
      category.run(12, 'Notas', 'text', 'ignored');
      category.run(13, 'Vazia', 'enum', null);
      const value = raw.prepare('INSERT INTO article_categories (article_id, category_id, value) VALUES (?, ?, ?)');
      value.run(1, 10, 'Survey');
      value.run(2, 11, 'IA, Educação, IA');
      value.run(3, 11, '');
      raw.prepare("DELETE FROM settings WHERE key = 'backfilled_category_options'").run();
    });
  }

  const optionsOf = (raw: Database.Database, categoryId: number) =>
    (raw.prepare('SELECT name FROM project_category_options WHERE category_id = ? ORDER BY id').all(categoryId) as { name: string }[]).map(
      (o) => o.name,
    );

  const selectionsOf = (raw: Database.Database, articleId: number) =>
    (
      raw
        .prepare(
          `SELECT o.name FROM article_category_selections s JOIN project_category_options o ON o.id = s.option_id
           WHERE s.article_id = ? ORDER BY o.id`,
        )
        .all(articleId) as { name: string }[]
    ).map((o) => o.name);

  it('turns comma-separated options and values into relational rows', () => {
    seedLegacyCategories();

    reopen((raw) => {
      expect(optionsOf(raw, 10)).toEqual(['Survey', 'Experimento']);
      expect(optionsOf(raw, 11)).toEqual(['IA', 'Saúde', 'Educação']);
      expect(optionsOf(raw, 12)).toEqual([]);
      expect(optionsOf(raw, 13)).toEqual([]);
      expect(selectionsOf(raw, 1)).toEqual(['Survey']);
      expect(selectionsOf(raw, 2)).toEqual(['IA', 'Educação']);
      expect(selectionsOf(raw, 3)).toEqual([]);
    });
  });

  it('runs only once', () => {
    seedLegacyCategories();
    new DatabaseAdapter(dbPath).close();

    reopen((raw) => expect(optionsOf(raw, 10)).toEqual(['Survey', 'Experimento']));
  });
});

describe('legacy schemas', () => {
  it('adds columns that older databases are missing', () => {
    withRawDatabase((raw) =>
      raw.exec(`
        CREATE TABLE massive_investigations (id INTEGER PRIMARY KEY, project_id INTEGER, questions TEXT, articles_ids TEXT);
        CREATE TABLE highlights (id INTEGER PRIMARY KEY, article_id INTEGER, color TEXT, position_data TEXT, annotation_id INTEGER);
        CREATE TABLE project_categories (id INTEGER PRIMARY KEY, project_id INTEGER, name TEXT, type TEXT);
      `),
    );

    const columns = reopen((db) => ({
      investigations: (db.pragma('table_info(massive_investigations)') as { name: string }[]).map((c) => c.name),
      highlights: (db.pragma('table_info(highlights)') as { name: string }[]).map((c) => c.name),
      categories: (db.pragma('table_info(project_categories)') as { name: string }[]).map((c) => c.name),
    }));

    expect(columns.investigations).toEqual(expect.arrayContaining(['model_used', 'status']));
    expect(columns.highlights).toContain('content_text');
    expect(columns.categories).toContain('options');
  });

  it('keeps only the latest diary entry per project and day in databases created before the unique constraint', () => {
    withRawDatabase((raw) => {
      raw.exec('CREATE TABLE project_diary (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, entry_date TEXT, content TEXT)');
      const entry = raw.prepare("INSERT INTO project_diary (project_id, entry_date, content) VALUES (1, '2026-01-01', ?)");
      entry.run('first');
      entry.run('latest');
    });

    const entries = reopen((raw) => raw.prepare('SELECT content FROM project_diary').all());

    expect(entries).toEqual([{ content: 'latest' }]);
  });
});

describe('migration failures are logged and do not prevent opening the database', () => {
  function failPrepareMatching(fragment: string): void {
    const realPrepare = Database.prototype.prepare;
    vi.spyOn(Database.prototype, 'prepare').mockImplementation(function (this: Database.Database, sql: string) {
      if (sql.includes(fragment)) throw new Error(`boom: ${fragment}`);
      return realPrepare.call(this, sql);
    });
  }

  function failExecStartingWith(prefix: string): void {
    const realExec = Database.prototype.exec;
    vi.spyOn(Database.prototype, 'exec').mockImplementation(function (this: Database.Database, sql: string) {
      if (sql.trim().startsWith(prefix)) throw new Error(`boom: ${prefix}`);
      return realExec.call(this, sql);
    });
  }

  it.each([
    ['is_oa backfill', () => failPrepareMatching('backfilled_is_oa_publisher'), 'Failed to backfill articles is_oa/publisher:'],
    ['category backfill', () => failPrepareMatching('backfilled_category_options'), 'Migration categories error'],
    ['vector table migration', () => failPrepareMatching('migrated_vec_dimensions_v3'), 'Migration sqlite-vec dimensions error'],
    ['pending highlights table', () => failExecStartingWith('CREATE TABLE IF NOT EXISTS pending_highlights'), 'Migration pending_highlights error'],
    [
      'massive investigations table',
      () => failExecStartingWith('CREATE TABLE IF NOT EXISTS massive_investigations'),
      'Migration massive_investigations error',
    ],
    [
      'PDF library backfill',
      () =>
        vi.spyOn(ArticleRepository.prototype, 'backfillExistingPdfs').mockImplementation(() => {
          throw new Error('boom');
        }),
      'Schema migrations error',
    ],
  ])('%s', (_label, induceFailure, logMessage) => {
    const consoleError = silenceConsoleError();
    induceFailure();

    const adapter = new DatabaseAdapter(dbPath);

    expect(consoleError).toHaveBeenCalledWith(logMessage, expect.any(Error));
    expect(adapter.checkIntegrity()).toBe(true);
    adapter.close();
  });
});

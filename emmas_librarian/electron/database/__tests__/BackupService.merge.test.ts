// AdmZip reads back empty entries under jsdom (Buffer/Uint8Array realm mismatch), so this suite runs in node.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AdmZip from 'adm-zip';
import type Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

const electron = vi.hoisted(() => ({ userData: '' }));

vi.mock('electron', () => ({
  safeStorage: {},
  app: {
    getPath: () => electron.userData,
    getVersion: () => '9.9.9',
    relaunch: vi.fn(),
    exit: vi.fn(),
  },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
}));

import { DatabaseAdapter } from '../DatabaseAdapter';
import { BackupService } from '../BackupService';

let workDir: string;
let active: DatabaseAdapter;
let backupPath: string;

const run = (db: Database.Database, sql: string, ...params: unknown[]) =>
  Number(db.prepare(sql).run(...params).lastInsertRowid);
const all = (sql: string, ...params: unknown[]) =>
  active
    .getDB()
    .prepare(sql)
    .all(...params) as Record<string, unknown>[];
const one = (sql: string, ...params: unknown[]) =>
  active
    .getDB()
    .prepare(sql)
    .get(...params) as Record<string, unknown>;

/** A backup made by the app: a real emma.db plus stored files, zipped like exportBackup does. */
function createBackup(seed: (db: Database.Database) => void, files: Record<string, string> = {}): string {
  const sourceDir = fs.mkdtempSync(path.join(workDir, 'source-'));
  const source = new DatabaseAdapter(path.join(sourceDir, 'emma.db'));
  seed(source.getDB());
  source.checkpoint();
  source.close();
  const zip = new AdmZip();
  zip.addFile('emma.db', fs.readFileSync(path.join(sourceDir, 'emma.db')));
  for (const [entry, content] of Object.entries(files)) zip.addFile(entry, Buffer.from(content));
  const zipPath = path.join(workDir, 'backup.emmabak');
  zip.writeZip(zipPath);
  return zipPath;
}

function seedFullProject(db: Database.Database): void {
  const project = run(db, "INSERT INTO projects (name, writing_pad) VALUES ('Tese', 'rascunho')");
  const search = run(
    db,
    "INSERT INTO search_history (project_id, unified_query, translated_queries, results_breakdown, sort_by, limit_val) VALUES (?, 'q', '{}', '{}', 'date', 20)",
    project,
  );
  const withPdf = run(
    db,
    `INSERT INTO articles (project_id, title, abstract, journal, volume, issue, pages, document_type, issn,
       citation_count, is_oa, publisher, author_keywords, search_id, local_file_path, status)
     VALUES (?, 'A', 'resumo', 'Revista', '4', '2', '9-12', 'article', '1234', 7, 1, 'Ed', 'k1; k2', ?, '/old/pdfs/a.pdf', 'read')`,
    project,
    search,
  );
  const plain = run(db, "INSERT INTO articles (project_id, title) VALUES (?, 'B')", project);
  run(
    db,
    "INSERT INTO project_documents (project_id, title, local_file_path, category, position) VALUES (?, 'Edital', '/old/docs/d.pdf', 'Chamadas', 3)",
    project,
  );
  const category = run(
    db,
    "INSERT INTO project_categories (project_id, name, type) VALUES (?, 'Método', 'select')",
    project,
  );
  const option = run(db, "INSERT INTO project_category_options (category_id, name) VALUES (?, 'Survey')", category);
  run(db, "INSERT INTO article_categories (article_id, category_id, value) VALUES (?, ?, 'x')", withPdf, category);
  run(
    db,
    'INSERT INTO article_category_selections (article_id, category_id, option_id) VALUES (?, ?, ?)',
    withPdf,
    category,
    option,
  );
  const investigation = run(
    db,
    "INSERT INTO massive_investigations (project_id, questions, articles_ids, status) VALUES (?, '[\"Q\"]', ?, 'Sucesso')",
    project,
    JSON.stringify([withPdf, plain]),
  );
  run(
    db,
    "INSERT INTO investigation_results (investigation_id, article_id, question, answer) VALUES (?, ?, 'Q', 'R')",
    investigation,
    withPdf,
  );
  const annotation = run(db, "INSERT INTO annotations (article_id, content_markdown) VALUES (?, 'nota')", withPdf);
  run(
    db,
    "INSERT INTO highlights (article_id, color, position_data, annotation_id) VALUES (?, 'yellow', '{}', ?)",
    withPdf,
    annotation,
  );
  run(db, "INSERT INTO pending_highlights (article_id, quote) VALUES (?, 'trecho')", withPdf);
  run(db, "INSERT INTO project_diary (project_id, entry_date, content) VALUES (?, '2026-01-01', 'dia')", project);
  run(
    db,
    "INSERT INTO project_diary_history (project_id, entry_date, content) VALUES (?, '2026-01-01', 'antes')",
    project,
  );
  run(db, "INSERT INTO question_sets (project_id, name, questions) VALUES (?, 'Set', '[]')", project);
}

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-backup-'));
  electron.userData = path.join(workDir, 'userData');
  fs.mkdirSync(electron.userData);
  active = new DatabaseAdapter(path.join(electron.userData, 'emma.db'));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  active.close();
  vi.restoreAllMocks();
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('BackupService.restoreBackupMerge with real databases', () => {
  beforeEach(() => {
    backupPath = createBackup(seedFullProject, {
      'storage/pdfs/a.pdf': 'PDF-A',
      'storage/project_documents/d.pdf': 'DOC-D',
    });
  });

  const merge = () => new BackupService(active).restoreBackupMerge(backupPath);
  const project = () => one("SELECT * FROM projects WHERE name = 'Tese'");

  it('imports the project with all of its fields', async () => {
    expect(await merge()).toBe(1);

    expect(project()).toMatchObject({ writing_pad: 'rascunho' });
  });

  it('keeps every article metadata column and links the article to its copied search', async () => {
    await merge();

    const article = one("SELECT * FROM articles WHERE title = 'A'");
    const search = one('SELECT * FROM search_history WHERE project_id = ?', project().id);
    expect(article).toMatchObject({
      project_id: project().id,
      abstract: 'resumo',
      journal: 'Revista',
      volume: '4',
      issue: '2',
      pages: '9-12',
      document_type: 'article',
      issn: '1234',
      citation_count: 7,
      is_oa: 1,
      publisher: 'Ed',
      author_keywords: 'k1; k2',
      status: 'read',
      search_id: search.id,
    });
    expect(search).toMatchObject({ sort_by: 'date', limit_val: 20 });
  });

  it('copies stored PDFs and documents under new names', async () => {
    await merge();

    const article = one("SELECT local_file_path FROM articles WHERE title = 'A'");
    const doc = one("SELECT * FROM project_documents WHERE title = 'Edital'");
    expect(fs.readFileSync(String(article.local_file_path), 'utf-8')).toBe('PDF-A');
    expect(path.dirname(String(article.local_file_path))).toBe(path.join(electron.userData, 'storage', 'pdfs'));
    expect(fs.readFileSync(String(doc.local_file_path), 'utf-8')).toBe('DOC-D');
    expect(doc).toMatchObject({ category: 'Chamadas', position: 3 });
  });

  it('remaps categories, options and article selections', async () => {
    await merge();

    const article = one("SELECT id FROM articles WHERE title = 'A'");
    const category = one('SELECT * FROM project_categories WHERE project_id = ?', project().id);
    const option = one('SELECT * FROM project_category_options WHERE category_id = ?', category.id);
    expect(option.name).toBe('Survey');
    expect(one('SELECT * FROM article_categories WHERE article_id = ?', article.id)).toMatchObject({
      category_id: category.id,
      value: 'x',
    });
    expect(one('SELECT * FROM article_category_selections WHERE article_id = ?', article.id)).toMatchObject({
      category_id: category.id,
      option_id: option.id,
    });
  });

  it('remaps investigations, their article ids and their results', async () => {
    await merge();

    const ids = all('SELECT id FROM articles WHERE project_id = ? ORDER BY title', project().id).map((a) => a.id);
    const investigation = one('SELECT * FROM massive_investigations WHERE project_id = ?', project().id);
    expect(JSON.parse(String(investigation.articles_ids))).toEqual(ids);
    expect(one('SELECT * FROM investigation_results WHERE investigation_id = ?', investigation.id)).toMatchObject({
      article_id: ids[0],
      answer: 'R',
    });
  });

  it('links highlights to their copied annotation and keeps pending highlights, diary and question sets', async () => {
    await merge();

    const article = one("SELECT id FROM articles WHERE title = 'A'");
    const annotation = one('SELECT * FROM annotations WHERE article_id = ?', article.id);
    expect(one('SELECT * FROM highlights WHERE article_id = ?', article.id).annotation_id).toBe(annotation.id);
    expect(one('SELECT quote FROM pending_highlights WHERE article_id = ?', article.id).quote).toBe('trecho');
    expect(one('SELECT content FROM project_diary WHERE project_id = ?', project().id).content).toBe('dia');
    expect(one('SELECT content FROM project_diary_history WHERE project_id = ?', project().id).content).toBe('antes');
    expect(one('SELECT name FROM question_sets WHERE project_id = ?', project().id).name).toBe('Set');
  });

  it('skips projects whose name already exists and leaves no temporary folder', async () => {
    run(active.getDB(), "INSERT INTO projects (name) VALUES ('Tese')");

    expect(await merge()).toBe(0);

    expect(all("SELECT id FROM projects WHERE name = 'Tese'")).toHaveLength(1);
    expect(fs.readdirSync(electron.userData).filter((f) => f.startsWith('temp_restore_'))).toEqual([]);
  });

  it('leaves the file path empty when the backup lacks the stored file', async () => {
    backupPath = createBackup(seedFullProject);

    await merge();

    expect(one("SELECT local_file_path FROM articles WHERE title = 'A'").local_file_path).toBeNull();
  });
});

describe('BackupService.restoreBackupMerge failures', () => {
  it('rejects a zip without emma.db and cleans up', async () => {
    const zip = new AdmZip();
    zip.addFile('other.txt', Buffer.from('x'));
    backupPath = path.join(workDir, 'bad.emmabak');
    zip.writeZip(backupPath);

    await expect(new BackupService(active).restoreBackupMerge(backupPath)).rejects.toThrow('não contém emma.db');
    expect(fs.readdirSync(electron.userData).filter((f) => f.startsWith('temp_restore_'))).toEqual([]);
  });

  it('logs but ignores a failure to close the backup database', async () => {
    backupPath = createBackup(() => undefined);
    const opener = (dbPath: string) => {
      const adapter = new DatabaseAdapter(dbPath);
      const close = adapter.close.bind(adapter);
      adapter.close = () => {
        close();
        throw new Error('busy');
      };
      return adapter;
    };

    expect(await new BackupService(active, opener).restoreBackupMerge(backupPath)).toBe(0);
    expect(console.error).toHaveBeenCalledWith('Erro ao fechar tempDb:', expect.any(Error));
  });
});

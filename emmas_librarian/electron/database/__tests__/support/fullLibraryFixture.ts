import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import { VectorStore } from '../../../services/VectorStore';
import { seedFullProject } from './fullProjectFixture';

const run = (db: Database.Database, sql: string, ...params: unknown[]) =>
  Number(db.prepare(sql).run(...params).lastInsertRowid);

/**
 * The library's own tables: without SQLite's internal ones and the storage tables sqlite-vec keeps
 * behind a virtual table (`pdf_chunk_embeddings_chunks`, ...), which are implementation details.
 *
 * Usage:
 *   libraryTables(db).forEach((table) => dump(table));
 */
export function libraryTables(db: Database.Database): string[] {
  const tables = db
    .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string; sql: string }[];
  const virtual = tables.filter((t) => /CREATE VIRTUAL TABLE/i.test(t.sql)).map((t) => t.name);
  return tables.map((t) => t.name).filter((name) => !virtual.some((v) => name.startsWith(`${v}_`)));
}

export interface LibraryFiles {
  pdfPath: string;
  docPath: string;
}

// Not a renderable PDF: the library only stores, hashes and copies these bytes.
const PDF_BYTES = Buffer.from('%PDF-1.4\n% Emma fixture: artigo A\n%%EOF\n');
const DOC_BYTES = Buffer.from('%PDF-1.4\n% Emma fixture: edital\n%%EOF\n');

/**
 * Writes a stored PDF and a project document where the app keeps them (userData/storage/...).
 *
 * Usage:
 *   const files = writeLibraryFiles(userDataDir);
 */
export function writeLibraryFiles(userData: string): LibraryFiles {
  const pdfPath = path.join(userData, 'storage', 'pdfs', 'artigo-a.pdf');
  const docPath = path.join(userData, 'storage', 'project_documents', 'edital.pdf');
  for (const [file, bytes] of [
    [pdfPath, PDF_BYTES],
    [docPath, DOC_BYTES],
  ] as const) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  }
  return { pdfPath, docPath };
}

/**
 * Every kind of data a library can hold, for tests that must prove nothing is lost (upgrades,
 * backups): the full "Tese" project, a second project with each category type and items in the
 * trash, a deleted project, the PDF library and its semantic-search index, the agenda, a global
 * question set, settings with API keys and a custom AI model. fullLibraryFixture.test.ts fails when
 * a table or column added later is left empty here.
 *
 * Usage:
 *   const files = writeLibraryFiles(userDataDir);
 *   seedFullLibrary(adapter.getDB(), files);
 */
export function seedFullLibrary(db: Database.Database, files: LibraryFiles): void {
  const thesis = seedFullProject(db, files);
  seedPdfLibrary(db, files.pdfPath);
  seedSemanticIndex(db, thesis);
  seedReviewProject(db);
  run(db, "INSERT INTO projects (name, deleted_at) VALUES ('Projeto antigo', '2026-02-01 08:00:00')");
  seedAgenda(db);
  run(
    db,
    "INSERT INTO question_sets (project_id, name, description, questions) VALUES (NULL, 'Global', 'todas', '[]')",
  );
  seedSettings(db);
}

function seedPdfLibrary(db: Database.Database, pdfPath: string): void {
  const bytes = fs.readFileSync(pdfPath);
  run(
    db,
    'INSERT INTO pdf_files (file_path, file_hash, filename, file_size) VALUES (?, ?, ?, ?)',
    pdfPath,
    crypto.createHash('sha256').update(bytes).digest('hex'),
    path.basename(pdfPath),
    bytes.length,
  );
}

// Indexed through the app's own VectorStore, so the vec0 table has the shape real imports create.
function seedSemanticIndex(db: Database.Database, project: number): void {
  const article = db.prepare("SELECT id FROM articles WHERE project_id = ? AND title = 'A'").get(project) as {
    id: number;
  };
  const chunk = { text: 'trecho indexado', page: 1, bbox: { x: 10, y: 20, w: 300, h: 40 } };
  new VectorStore(db).indexArticleChunks(article.id, [chunk], [[0.1, 0.2, 0.3, 0.4]]);
  // The app writes no token count today; older versions may have, so the column is kept filled.
  db.prepare('UPDATE pdf_chunks SET token_count = 12 WHERE article_id = ?').run(article.id);
}

// The category types the UI offers besides the thesis' enum, and one of each item kind in the trash.
function seedReviewProject(db: Database.Database): void {
  const project = run(db, "INSERT INTO projects (name) VALUES ('Revisão')");
  const article = run(db, "INSERT INTO articles (project_id, title) VALUES (?, 'C')", project);
  run(
    db,
    "INSERT INTO articles (project_id, title, deleted_at) VALUES (?, 'Na lixeira', '2026-02-02 09:00:00')",
    project,
  );
  run(
    db,
    "INSERT INTO annotations (article_id, content_markdown, deleted_at) VALUES (?, 'nota apagada', '2026-02-03 09:00:00')",
    article,
  );
  const category = (name: string, type: string) =>
    run(db, 'INSERT INTO project_categories (project_id, name, type) VALUES (?, ?, ?)', project, name, type);
  const setValue = (categoryId: number, value: string) =>
    run(
      db,
      'INSERT INTO article_categories (article_id, category_id, value) VALUES (?, ?, ?)',
      article,
      categoryId,
      value,
    );
  setValue(category('Observação', 'text'), 'revisar');
  setValue(category('Incluído', 'boolean'), 'true');
  seedMultiselect(db, category('Bases', 'multiselect'), article);
}

function seedMultiselect(db: Database.Database, category: number, article: number): void {
  for (const name of ['Scopus', 'OpenAlex']) {
    const option = run(db, 'INSERT INTO project_category_options (category_id, name) VALUES (?, ?)', category, name);
    run(
      db,
      'INSERT INTO article_category_selections (article_id, category_id, option_id) VALUES (?, ?, ?)',
      article,
      category,
      option,
    );
  }
}

function seedAgenda(db: Database.Database): void {
  const venue = run(
    db,
    "INSERT INTO scientific_venues (title, acronym, category, url, color) VALUES ('Congresso X', 'CX', 'conference', 'https://cx.org', '#10b981')",
  );
  run(
    db,
    `INSERT INTO scientific_milestones (venue_id, label, field_type, target_date, end_date, has_time, target_time, status)
     VALUES (?, 'Submissão', 'range', '2026-11-01', '2026-11-05', 1, '14:00', 'done')`,
    venue,
  );
}

// API keys go in as safeStorage leaves them (base64 of an encrypted blob); tests mock safeStorage.
function seedSettings(db: Database.Database): void {
  const settings: [string, string][] = [
    ['theme', 'dark'],
    ['enable_auto_backups', 'false'],
    ['ollama_base_url', 'http://localhost:11434'],
    ['rag_chunk_size', '800'],
    ['api_key_openai', Buffer.from('encrypted-openai-key').toString('base64')],
    ['scopus_api_key', Buffer.from('encrypted-scopus-key').toString('base64')],
  ];
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  settings.forEach(([key, value]) => upsert.run(key, value));
  // The schema seeds one row per skill; a person's choice replaces the default.
  db.prepare(
    "UPDATE ai_model_config SET provider = 'ollama', model_name = 'llama-fixture' WHERE skill = 'metadata'",
  ).run();
}

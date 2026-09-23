import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

interface TableInfoRow {
  name: string;
}

// Columns added after the first public release; ALTER fails harmlessly once a column exists.
const COLUMN_MIGRATIONS = [
  'ALTER TABLE articles ADD COLUMN archive_note TEXT',
  'ALTER TABLE articles ADD COLUMN abstract TEXT',
  'ALTER TABLE articles ADD COLUMN author_keywords TEXT',
  'ALTER TABLE articles ADD COLUMN index_keywords TEXT',
  'ALTER TABLE articles ADD COLUMN journal TEXT',
  'ALTER TABLE articles ADD COLUMN volume TEXT',
  'ALTER TABLE articles ADD COLUMN issue TEXT',
  'ALTER TABLE articles ADD COLUMN pages TEXT',
  'ALTER TABLE articles ADD COLUMN affiliations TEXT',
  'ALTER TABLE articles ADD COLUMN references_list TEXT',
  'ALTER TABLE articles ADD COLUMN document_type TEXT',
  'ALTER TABLE articles ADD COLUMN issn TEXT',
  'ALTER TABLE articles ADD COLUMN citation_count INTEGER',
  'ALTER TABLE articles ADD COLUMN search_id INTEGER REFERENCES search_history(id) ON DELETE SET NULL',
  'ALTER TABLE articles ADD COLUMN ai_summary TEXT',
  'ALTER TABLE projects ADD COLUMN writing_pad TEXT',
  'ALTER TABLE articles ADD COLUMN is_oa INTEGER',
  'ALTER TABLE articles ADD COLUMN publisher TEXT',
  'ALTER TABLE articles ADD COLUMN url TEXT',
  'ALTER TABLE articles ADD COLUMN accessed TEXT',
  'ALTER TABLE projects ADD COLUMN deleted_at DATETIME DEFAULT NULL',
  'ALTER TABLE articles ADD COLUMN deleted_at DATETIME DEFAULT NULL',
  'ALTER TABLE annotations ADD COLUMN deleted_at DATETIME DEFAULT NULL',
  `CREATE TABLE IF NOT EXISTS project_diary_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      entry_date TEXT NOT NULL,
      content TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  'ALTER TABLE search_history ADD COLUMN sort_by TEXT',
  'ALTER TABLE search_history ADD COLUMN limit_val INTEGER',
  'ALTER TABLE project_documents ADD COLUMN position INTEGER DEFAULT 0',
  'ALTER TABLE project_documents ADD COLUMN category TEXT DEFAULT NULL',
];

const PENDING_HIGHLIGHTS_TABLE = `
  CREATE TABLE IF NOT EXISTS pending_highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      quote TEXT NOT NULL,
      context_before TEXT,
      context_after TEXT,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
  );`;

const MASSIVE_INVESTIGATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS massive_investigations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      questions TEXT NOT NULL,
      articles_ids TEXT NOT NULL,
      model_used TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );`;

const CATEGORY_TABLES = `
  CREATE TABLE IF NOT EXISTS project_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      options TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS project_category_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY(category_id) REFERENCES project_categories(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS article_categories (
      article_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      value TEXT,
      PRIMARY KEY(article_id, category_id),
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY(category_id) REFERENCES project_categories(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS article_category_selections (
      article_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      option_id INTEGER NOT NULL,
      PRIMARY KEY(article_id, category_id, option_id),
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY(category_id) REFERENCES project_categories(id) ON DELETE CASCADE,
      FOREIGN KEY(option_id) REFERENCES project_category_options(id) ON DELETE CASCADE
  );`;

// The vector schema changed dimensions; chunks are cheap to rebuild, so the tables are recreated once.
const VECTOR_TABLES_V3 = `
  DROP TABLE IF EXISTS pdf_chunk_embeddings;
  DROP TABLE IF EXISTS pdf_chunks;
  CREATE TABLE IF NOT EXISTS pdf_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      text_content TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      bbox_x REAL,
      bbox_y REAL,
      bbox_w REAL,
      bbox_h REAL,
      token_count INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
  );`;

const PDF_LIBRARY_TABLE = `
  CREATE TABLE IF NOT EXISTS pdf_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT UNIQUE NOT NULL,
      file_hash TEXT UNIQUE NOT NULL,
      filename TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`;

/**
 * Creates the schema and upgrades databases created by older versions. Every step is idempotent;
 * a failing step is logged and skipped so the app still opens.
 *
 * Usage:
 *   initializeSchema(db, () => articleRepo.backfillExistingPdfs());
 */
export function initializeSchema(db: Database.Database, backfillPdfLibrary: () => void): void {
  db.exec(readSchemaFile());
  applyColumnMigrations(db);
  logFailure('Failed to backfill articles is_oa/publisher:', () => backfillOpenAccessAndPublisher(db));
  logFailure('Migration pending_highlights error', () => db.exec(PENDING_HIGHLIGHTS_TABLE));
  logFailure('Migration massive_investigations error', () => db.exec(MASSIVE_INVESTIGATIONS_TABLE));
  logFailure('Migration categories error', () => migrateCategories(db));
  logFailure('Migration sqlite-vec dimensions error', () => migrateVectorTables(db));
  logFailure('Schema migrations error', () => applyLegacyFixes(db, backfillPdfLibrary));
}

// schema.sql sits next to this file in dev/tests but under different roots once compiled.
function readSchemaFile(): string {
  const candidates = [
    path.join(__dirname, 'schema.sql'),
    path.join(__dirname, '..', '..', 'electron', 'database', 'schema.sql'),
    path.join(__dirname, '..', '..', '..', 'electron', 'database', 'schema.sql'),
    path.join(process.cwd(), 'electron', 'database', 'schema.sql'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Could not find schema.sql. Checked: ' + candidates.join(', '));
  return fs.readFileSync(found, 'utf-8');
}

function applyColumnMigrations(db: Database.Database): void {
  for (const sql of COLUMN_MIGRATIONS) {
    try {
      db.exec(sql);
    } catch {
      /* column already exists */
    }
  }
}

function logFailure(message: string, step: () => void): void {
  try {
    step();
  } catch (err) {
    console.error(message, err);
  }
}

// Setting keys are constants, so they are inlined to keep each flag query self-describing.
function isFlagSet(db: Database.Database, key: string): boolean {
  const row = db.prepare(`SELECT value FROM settings WHERE key = '${key}'`).get() as { value: string } | undefined;
  return row?.value === 'true';
}

function setFlag(db: Database.Database, key: string): void {
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('${key}', 'true')`).run();
}

function backfillOpenAccessAndPublisher(db: Database.Database): void {
  if (isFlagSet(db, 'backfilled_is_oa_publisher')) return;
  const rows = db.prepare('SELECT id, csl_json FROM articles WHERE csl_json IS NOT NULL').all() as { id: number; csl_json: string }[];
  if (rows.length > 0) {
    const update = db.prepare('UPDATE articles SET is_oa = ?, publisher = ? WHERE id = ?');
    db.transaction(() => rows.forEach((row) => updateOpenAccessFromCsl(update, row)))();
  }
  setFlag(db, 'backfilled_is_oa_publisher');
}

function updateOpenAccessFromCsl(update: Database.Statement, row: { id: number; csl_json: string }): void {
  try {
    const csl = JSON.parse(row.csl_json);
    const isOa = csl.is_oa !== undefined ? (csl.is_oa ? 1 : 0) : null;
    update.run(isOa, csl.publisher || null, row.id);
  } catch {
    /* malformed csl_json: leave the row untouched */
  }
}

function migrateCategories(db: Database.Database): void {
  db.exec(CATEGORY_TABLES);
  addColumnIfMissing(db, 'project_categories', 'options', 'ALTER TABLE project_categories ADD COLUMN options TEXT;');
  if (isFlagSet(db, 'backfilled_category_options')) return;
  db.transaction(() => backfillCategoryOptions(db))();
  setFlag(db, 'backfilled_category_options');
}

// Older versions stored enum/multiselect options and values as comma-separated text.
function backfillCategoryOptions(db: Database.Database): void {
  const categories = db
    .prepare("SELECT id, type, options FROM project_categories WHERE type IN ('enum', 'multiselect')")
    .all() as { id: number; options?: string }[];
  const insertOption = db.prepare('INSERT INTO project_category_options (category_id, name) VALUES (?, ?)');
  const insertSelection = db.prepare('INSERT INTO article_category_selections (article_id, category_id, option_id) VALUES (?, ?, ?)');
  for (const category of categories.filter((c) => c.options)) {
    const optionIds = new Map<string, number>();
    const optionId = (name: string) => optionIds.get(name) ?? rememberOption(optionIds, name, insertOption.run(category.id, name));
    splitCsv(category.options).forEach(optionId);
    const assignments = db.prepare('SELECT article_id, value FROM article_categories WHERE category_id = ?').all(category.id) as {
      article_id: number;
      value?: string;
    }[];
    for (const assignment of assignments) {
      splitCsv(assignment.value).forEach((name) => insertIgnoringDuplicates(insertSelection, assignment.article_id, category.id, optionId(name)));
    }
  }
}

function rememberOption(ids: Map<string, number>, name: string, result: Database.RunResult): number {
  ids.set(name, result.lastInsertRowid as number);
  return result.lastInsertRowid as number;
}

function insertIgnoringDuplicates(insert: Database.Statement, articleId: number, categoryId: number, optionId: number): void {
  try {
    insert.run(articleId, categoryId, optionId);
  } catch {
    /* the same option listed twice for one article */
  }
}

const splitCsv = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

function migrateVectorTables(db: Database.Database): void {
  if (isFlagSet(db, 'migrated_vec_dimensions_v3')) return;
  db.transaction(() => db.exec(VECTOR_TABLES_V3))();
  setFlag(db, 'migrated_vec_dimensions_v3');
}

function applyLegacyFixes(db: Database.Database, backfillPdfLibrary: () => void): void {
  addColumnIfMissing(db, 'massive_investigations', 'model_used', 'ALTER TABLE massive_investigations ADD COLUMN model_used TEXT');
  addColumnIfMissing(db, 'massive_investigations', 'status', 'ALTER TABLE massive_investigations ADD COLUMN status TEXT');
  addColumnIfMissing(db, 'highlights', 'content_text', 'ALTER TABLE highlights ADD COLUMN content_text TEXT');
  // Keep only the latest diary entry per day, then enforce it (older schemas lacked the constraint).
  db.exec(`DELETE FROM project_diary WHERE id NOT IN (SELECT MAX(id) FROM project_diary GROUP BY project_id, entry_date);`);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_project_diary_unique ON project_diary(project_id, entry_date);');
  db.exec(PDF_LIBRARY_TABLE);
  backfillPdfLibrary();
}

function addColumnIfMissing(db: Database.Database, table: string, column: string, alterSql: string): void {
  const columns = db.pragma(`table_info(${table})`) as TableInfoRow[];
  if (!columns.some((col) => col.name === column)) db.prepare(alterSql).run();
}

import { expect } from 'vitest';
import type Database from 'better-sqlite3';

type Row = Record<string, unknown>;

const run = (db: Database.Database, sql: string, ...params: unknown[]) =>
  Number(db.prepare(sql).run(...params).lastInsertRowid);
const one = (db: Database.Database, sql: string, ...params: unknown[]) => db.prepare(sql).get(...params) as Row;

/**
 * A project named "Tese" with a row in every table an export/backup must carry, and every column of
 * those rows filled (fullLibraryFixture.test.ts fails when a new column is left empty): a search, an
 * article with full metadata (PDF at `pdfPath`) and an archived one, a document (file at `docPath`),
 * an enum (single choice) category with an option and selections, an investigation with a result and a failed one,
 * an annotation linked both ways to its highlight, a pending highlight, diary + history and a
 * question set.
 *
 * Usage:
 *   const projectId = seedFullProject(db, { pdfPath: '/old/pdfs/a.pdf', docPath: '/old/docs/d.pdf' });
 */
export function seedFullProject(db: Database.Database, files: { pdfPath: string; docPath: string }): number {
  const project = run(
    db,
    "INSERT INTO projects (name, writing_pad, last_executed_at) VALUES ('Tese', 'rascunho', '2026-01-02 10:00:00')",
  );
  const search = run(
    db,
    `INSERT INTO search_history (project_id, unified_query, translated_queries, total_results, results_breakdown,
       sort_by, limit_val, query_state, unique_results)
     VALUES (?, 'q', '{}', 7, '{}', 'date', 20, '{"groups":[]}', 5)`,
    project,
  );
  const withPdf = seedArticleWithPdf(db, project, search, files.pdfPath);
  const plain = run(
    db,
    "INSERT INTO articles (project_id, title, status, archive_note) VALUES (?, 'B', 'archived', 'fora do escopo')",
    project,
  );
  run(
    db,
    `INSERT INTO project_documents (project_id, title, url, local_file_path, category, position)
     VALUES (?, 'Edital', 'https://example.org/edital', ?, 'Chamadas', 3)`,
    project,
    files.docPath,
  );
  seedCategories(db, project, withPdf);
  seedInvestigation(db, project, withPdf, plain);
  seedReadingNotes(db, project, withPdf);
  stampDatesInThePast(db, project);
  return project;
}

// Every metadata column a search, an import or the citation editor can fill.
function seedArticleWithPdf(db: Database.Database, project: number, search: number, pdfPath: string): number {
  return run(
    db,
    `INSERT INTO articles (project_id, title, doi, authors, year, source_query, source_databases, csl_json,
       abstract, journal, volume, issue, pages, document_type, issn, citation_count, is_oa, publisher, url,
       accessed, author_keywords, index_keywords, affiliations, references_list, ai_summary, search_id,
       local_file_path, status)
     VALUES (?, 'A', '10.1000/a', 'Silva, Ana; Souza, Bia', 2024, 'q', '["openalex"]', '{"title":"A","type":"article-journal"}',
       'resumo', 'Revista', '4', '2', '9-12', 'article', '1234', 0, 1, 'Ed', 'https://example.org/a',
       '2026-01-03', 'k1; k2', 'i1; i2', 'Universidade X', 'Ref 1; Ref 2', 'resumo da IA', ?, ?, 'read')`,
    project,
    search,
    pdfPath,
  );
}

function seedCategories(db: Database.Database, project: number, article: number): void {
  // `options` is the comma-separated list older versions kept before project_category_options existed.
  const category = run(
    db,
    "INSERT INTO project_categories (project_id, name, type, options) VALUES (?, 'Método', 'enum', 'Survey')",
    project,
  );
  const option = run(db, "INSERT INTO project_category_options (category_id, name) VALUES (?, 'Survey')", category);
  run(db, "INSERT INTO article_categories (article_id, category_id, value) VALUES (?, ?, 'x')", article, category);
  run(
    db,
    'INSERT INTO article_category_selections (article_id, category_id, option_id) VALUES (?, ?, ?)',
    article,
    category,
    option,
  );
}

function seedInvestigation(db: Database.Database, project: number, article: number, other: number): void {
  const investigation = run(
    db,
    "INSERT INTO massive_investigations (project_id, questions, articles_ids, model_used, status) VALUES (?, '[\"Q\"]', ?, 'gpt-x', 'Sucesso')",
    project,
    JSON.stringify([article, other]),
  );
  run(
    db,
    "INSERT INTO investigation_results (investigation_id, article_id, question, answer, quote) VALUES (?, ?, 'Q', 'R', 'citação')",
    investigation,
    article,
  );
  run(
    db,
    "INSERT INTO investigation_results (investigation_id, article_id, question, status, error_message) VALUES (?, ?, 'Q', 'error', 'sem texto')",
    investigation,
    other,
  );
}

function seedReadingNotes(db: Database.Database, project: number, article: number): void {
  const annotation = run(db, "INSERT INTO annotations (article_id, content_markdown) VALUES (?, 'nota')", article);
  const highlight = run(
    db,
    "INSERT INTO highlights (article_id, color, position_data, content_text, annotation_id) VALUES (?, 'yellow', '{}', 'texto marcado', ?)",
    article,
    annotation,
  );
  // Older versions linked the note to its highlight too; the project import still copies this column.
  db.prepare('UPDATE annotations SET highlight_id = ? WHERE id = ?').run(highlight, annotation);
  run(
    db,
    "INSERT INTO pending_highlights (article_id, quote, context_before, context_after, comment) VALUES (?, 'trecho', 'antes', 'depois', 'comentário')",
    article,
  );
  run(db, "INSERT INTO project_diary (project_id, entry_date, content) VALUES (?, '2026-01-01', 'dia')", project);
  run(
    db,
    "INSERT INTO project_diary_history (project_id, entry_date, content) VALUES (?, '2026-01-01', 'antes')",
    project,
  );
  run(
    db,
    "INSERT INTO question_sets (project_id, name, description, questions) VALUES (?, 'Set', 'perguntas', '[]')",
    project,
  );
}

/**
 * Checks that the copy of `seedFullProject` at `projectId` kept every column and that all of its
 * foreign keys point at the copied rows, not at the originals.
 *
 * Usage:
 *   expectFullProjectCopied(db, importedProjectId);
 */
export function expectFullProjectCopied(db: Database.Database, projectId: number): void {
  const article = one(db, "SELECT * FROM articles WHERE project_id = ? AND title = 'A'", projectId);
  const other = one(db, "SELECT id FROM articles WHERE project_id = ? AND title = 'B'", projectId);
  const search = one(db, 'SELECT * FROM search_history WHERE project_id = ?', projectId);
  expect(one(db, 'SELECT writing_pad FROM projects WHERE id = ?', projectId).writing_pad).toBe('rascunho');
  expect(search).toMatchObject({ sort_by: 'date', limit_val: 20 });
  expect(article).toMatchObject({
    abstract: 'resumo',
    journal: 'Revista',
    volume: '4',
    issue: '2',
    pages: '9-12',
    document_type: 'article',
    issn: '1234',
    citation_count: 0,
    is_oa: 1,
    publisher: 'Ed',
    author_keywords: 'k1; k2',
    status: 'read',
    search_id: search.id,
  });
  expect(one(db, 'SELECT category, position FROM project_documents WHERE project_id = ?', projectId)).toEqual({
    category: 'Chamadas',
    position: 3,
  });
  expectCategoriesCopied(db, projectId, Number(article.id));
  expectInvestigationCopied(db, projectId, [Number(article.id), Number(other.id)]);
  expectReadingNotesCopied(db, projectId, Number(article.id));
}

function expectCategoriesCopied(db: Database.Database, projectId: number, articleId: number): void {
  const category = one(db, 'SELECT * FROM project_categories WHERE project_id = ?', projectId);
  const option = one(db, 'SELECT * FROM project_category_options WHERE category_id = ?', category.id);
  expect(option.name).toBe('Survey');
  expect(one(db, 'SELECT * FROM article_categories WHERE article_id = ?', articleId)).toMatchObject({
    category_id: category.id,
    value: 'x',
  });
  expect(one(db, 'SELECT * FROM article_category_selections WHERE article_id = ?', articleId)).toMatchObject({
    category_id: category.id,
    option_id: option.id,
  });
}

function expectInvestigationCopied(db: Database.Database, projectId: number, articleIds: number[]): void {
  const investigation = one(db, 'SELECT * FROM massive_investigations WHERE project_id = ?', projectId);
  expect(JSON.parse(String(investigation.articles_ids))).toEqual(articleIds);
  expect(one(db, 'SELECT * FROM investigation_results WHERE investigation_id = ?', investigation.id)).toMatchObject({
    article_id: articleIds[0],
    answer: 'R',
  });
}

function expectReadingNotesCopied(db: Database.Database, projectId: number, articleId: number): void {
  const annotation = one(db, 'SELECT * FROM annotations WHERE article_id = ?', articleId);
  expect(one(db, 'SELECT annotation_id FROM highlights WHERE article_id = ?', articleId).annotation_id).toBe(
    annotation.id,
  );
  expect(one(db, 'SELECT quote FROM pending_highlights WHERE article_id = ?', articleId).quote).toBe('trecho');
  expect(one(db, 'SELECT content FROM project_diary WHERE project_id = ?', projectId).content).toBe('dia');
  expect(one(db, 'SELECT content FROM project_diary_history WHERE project_id = ?', projectId).content).toBe('antes');
  expect(one(db, 'SELECT name FROM question_sets WHERE project_id = ?', projectId).name).toBe('Set');
}

// Where each project-scoped table keeps its rows; a table added to a project needs an entry here.
const ARTICLES_OF_PROJECT = 'article_id IN (SELECT id FROM articles WHERE project_id = @project)';
const PROJECT_SCOPE: Record<string, string> = {
  projects: 'id = @project',
  search_history: 'project_id = @project',
  articles: 'project_id = @project',
  project_documents: 'project_id = @project',
  project_categories: 'project_id = @project',
  massive_investigations: 'project_id = @project',
  project_diary: 'project_id = @project',
  project_diary_history: 'project_id = @project',
  question_sets: 'project_id = @project',
  annotations: ARTICLES_OF_PROJECT,
  highlights: ARTICLES_OF_PROJECT,
  pending_highlights: ARTICLES_OF_PROJECT,
  article_categories: ARTICLES_OF_PROJECT,
  article_category_selections: ARTICLES_OF_PROJECT,
  project_category_options: 'category_id IN (SELECT id FROM project_categories WHERE project_id = @project)',
  investigation_results: 'investigation_id IN (SELECT id FROM massive_investigations WHERE project_id = @project)',
};

// Keys that point at other rows: a copy gives them new values on purpose, in every table.
const KEY_COLUMNS = new Set([
  'id',
  'project_id',
  'article_id',
  'category_id',
  'option_id',
  'investigation_id',
  'annotation_id',
  'highlight_id',
  'search_id',
]);

// What else differs on purpose in a copy, table by table: stored files are moved into this installation,
// the project name gets "(Importado)", and the investigation's article ids point at the copied articles.
// Per table, so a column added to another table with one of these names is compared, not ignored.
const REMAPPED_COLUMNS: Record<string, string[]> = {
  projects: ['name'],
  articles: ['local_file_path'],
  project_documents: ['local_file_path'],
  massive_investigations: ['articles_ids'],
};

const comparableRow = (table: string, row: Row) =>
  JSON.stringify(
    Object.entries(row)
      .filter(([column]) => !KEY_COLUMNS.has(column) && !(REMAPPED_COLUMNS[table] ?? []).includes(column))
      .sort(([a], [b]) => a.localeCompare(b)),
  );

// Rows get CURRENT_TIMESTAMP when inserted, which a copy made seconds later could match by accident. Fixed
// past dates make "the copy kept the dates" a real check.
const PAST_CREATED_AT = '2025-03-04 05:06:07';
const PAST_UPDATED_AT = '2025-03-05 06:07:08';

function stampDatesInThePast(db: Database.Database, project: number): void {
  for (const [table, where] of Object.entries(PROJECT_SCOPE)) {
    const columns = (db.pragma(`table_info(${table})`) as { name: string }[]).map(({ name }) => name);
    for (const [column, stamp] of [
      ['created_at', PAST_CREATED_AT],
      ['updated_at', PAST_UPDATED_AT],
    ]) {
      if (columns.includes(column))
        db.prepare(`UPDATE ${table} SET ${column} = @stamp WHERE ${where}`).run({ stamp, project });
    }
  }
}

/**
 * `table.column` of the project's rows whose created_at/updated_at is still the time they were inserted
 * (seedFullProject stamps fixed past dates), so a copy that lost the dates could not be told apart.
 *
 * Usage:
 *   expect(columnsDatedNow(db, projectId)).toEqual([]);
 */
export function columnsDatedNow(db: Database.Database, projectId: number): string[] {
  return Object.entries(PROJECT_SCOPE).flatMap(([table, where]) =>
    ['created_at', 'updated_at']
      .filter((column) => (db.pragma(`table_info(${table})`) as { name: string }[]).some(({ name }) => name === column))
      .filter((column) => {
        const sql = `SELECT count(*) AS n FROM ${table} WHERE ${where} AND ${column} >= datetime('now', '-1 day')`;
        return (db.prepare(sql).get({ project: projectId }) as { n: number }).n > 0;
      })
      .map((column) => `${table}.${column}`),
  );
}

/** The tables projectContent compares. */
export const projectScopedTables = (): string[] => Object.keys(PROJECT_SCOPE);

/**
 * Every value of a project, table by table, without the keys and files a copy remaps (dates are
 * compared); equal results mean an
 * export/import or backup merge kept every column of every row.
 *
 * Usage:
 *   expect(projectContent(db, importedId)).toEqual(projectContent(db, originalId));
 */
export function projectContent(db: Database.Database, projectId: number): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(PROJECT_SCOPE).map(([table, where]) => [
      table,
      (db.prepare(`SELECT * FROM ${table} WHERE ${where}`).all({ project: projectId }) as Row[])
        .map((row) => comparableRow(table, row))
        .sort(),
    ]),
  );
}

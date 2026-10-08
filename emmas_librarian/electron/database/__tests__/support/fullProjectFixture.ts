import type Database from 'better-sqlite3';

type Row = Record<string, unknown>;

const run = (db: Database.Database, sql: string, ...params: unknown[]) =>
  Number(db.prepare(sql).run(...params).lastInsertRowid);

/**
 * A project named "Tese" with a row in every table an export/backup must carry, and every column of
 * those rows filled (fullLibraryFixture.test.ts fails when a new column is left empty): a search, an
 * article with full metadata (PDF at `pdfPath`) and an archived one, a document (file at `docPath`),
 * an enum (single choice) category with an option and selections, an investigation with a result and a failed one,
 * an annotation linked both ways to its highlight, a pending highlight, diary + history and a
 * question set.
 *
 * Free of vitest so the release test (Playwright) can seed with it too; checks live in
 * fullProjectAssertions.ts.
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

// Differ on purpose in a copy: row ids and the keys pointing at them, stored files (moved into this
// installation), creation times, and the project name ("Tese (Importado)").
const REMAPPED_COLUMNS = new Set([
  'id',
  'project_id',
  'article_id',
  'category_id',
  'option_id',
  'investigation_id',
  'annotation_id',
  'highlight_id',
  'search_id',
  'articles_ids',
  'local_file_path',
  'created_at',
  'updated_at',
]);

const comparableRow = (table: string, row: Row) =>
  JSON.stringify(
    Object.entries(row)
      .filter(([column]) => !REMAPPED_COLUMNS.has(column) && !(table === 'projects' && column === 'name'))
      .sort(([a], [b]) => a.localeCompare(b)),
  );

/** The tables projectContent compares. */
export const projectScopedTables = (): string[] => Object.keys(PROJECT_SCOPE);

/**
 * Every value of a project, table by table, without what a copy remaps; equal results mean an
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

import { expect } from 'vitest';
import type Database from 'better-sqlite3';

type Row = Record<string, unknown>;

const run = (db: Database.Database, sql: string, ...params: unknown[]) =>
  Number(db.prepare(sql).run(...params).lastInsertRowid);
const one = (db: Database.Database, sql: string, ...params: unknown[]) => db.prepare(sql).get(...params) as Row;

/**
 * A project named "Tese" with a row in every table an export/backup must carry: a search, an
 * article with full metadata (PDF at `pdfPath`) and one without, a document (file at `docPath`),
 * a select category with an option and selections, an investigation with a result, an annotation
 * with its highlight, a pending highlight, diary + history and a question set.
 *
 * Usage:
 *   const projectId = seedFullProject(db, { pdfPath: '/old/pdfs/a.pdf', docPath: '/old/docs/d.pdf' });
 */
export function seedFullProject(db: Database.Database, files: { pdfPath: string; docPath: string }): number {
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
     VALUES (?, 'A', 'resumo', 'Revista', '4', '2', '9-12', 'article', '1234', 0, 1, 'Ed', 'k1; k2', ?, ?, 'read')`,
    project,
    search,
    files.pdfPath,
  );
  const plain = run(db, "INSERT INTO articles (project_id, title) VALUES (?, 'B')", project);
  run(
    db,
    "INSERT INTO project_documents (project_id, title, local_file_path, category, position) VALUES (?, 'Edital', ?, 'Chamadas', 3)",
    project,
    files.docPath,
  );
  seedCategories(db, project, withPdf);
  seedInvestigation(db, project, withPdf, plain);
  seedReadingNotes(db, project, withPdf);
  return project;
}

function seedCategories(db: Database.Database, project: number, article: number): void {
  const category = run(
    db,
    "INSERT INTO project_categories (project_id, name, type) VALUES (?, 'Método', 'select')",
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
    "INSERT INTO massive_investigations (project_id, questions, articles_ids, status) VALUES (?, '[\"Q\"]', ?, 'Sucesso')",
    project,
    JSON.stringify([article, other]),
  );
  run(
    db,
    "INSERT INTO investigation_results (investigation_id, article_id, question, answer) VALUES (?, ?, 'Q', 'R')",
    investigation,
    article,
  );
}

function seedReadingNotes(db: Database.Database, project: number, article: number): void {
  const annotation = run(db, "INSERT INTO annotations (article_id, content_markdown) VALUES (?, 'nota')", article);
  run(
    db,
    "INSERT INTO highlights (article_id, color, position_data, annotation_id) VALUES (?, 'yellow', '{}', ?)",
    article,
    annotation,
  );
  run(db, "INSERT INTO pending_highlights (article_id, quote) VALUES (?, 'trecho')", article);
  run(db, "INSERT INTO project_diary (project_id, entry_date, content) VALUES (?, '2026-01-01', 'dia')", project);
  run(
    db,
    "INSERT INTO project_diary_history (project_id, entry_date, content) VALUES (?, '2026-01-01', 'antes')",
    project,
  );
  run(db, "INSERT INTO question_sets (project_id, name, questions) VALUES (?, 'Set', '[]')", project);
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

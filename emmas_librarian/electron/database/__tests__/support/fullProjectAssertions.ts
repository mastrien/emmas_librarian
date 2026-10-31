import { expect } from 'vitest';
import type Database from 'better-sqlite3';

type Row = Record<string, unknown>;

const one = (db: Database.Database, sql: string, ...params: unknown[]) => db.prepare(sql).get(...params) as Row;

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
  expectScreeningCopied(db, projectId, Number(other.id));
}

function expectScreeningCopied(db: Database.Database, projectId: number, articleId: number): void {
  const label = one(db, "SELECT * FROM screening_labels WHERE project_id = ? AND name = 'Fora do escopo'", projectId);
  expect(label).toMatchObject({ kind: 'exclude', position: 2, preset_key: 'excluded' });
  expect(one(db, 'SELECT * FROM screening_decisions WHERE article_id = ?', articleId)).toMatchObject({
    label_id: label.id,
    stage: 'full',
    note: 'só radar',
    status_before: 'read',
  });
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
  expect(one(db, 'SELECT * FROM investigation_audits WHERE investigation_id = ?', investigation.id)).toMatchObject({
    seed: 48213,
    sample_percent: 10,
    min_per_question: 2,
  });
  expect(JSON.parse(String(investigation.articles_ids))).toEqual(articleIds);
  expect(one(db, 'SELECT * FROM investigation_results WHERE investigation_id = ?', investigation.id)).toMatchObject({
    article_id: articleIds[0],
    answer: 'R',
    review_status: 'edited',
    reviewed_answer: 'R revisada',
    reviewed_at: '2026-10-18T10:00:00.000Z',
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

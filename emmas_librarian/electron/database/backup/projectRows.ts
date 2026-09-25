import type Database from 'better-sqlite3';
import { rowsOfProject, type SqlRow } from './rowCopy';

/**
 * Everything that belongs to one project, table by table. The keys are the `project.json`
 * format of .emmapcarc files, so they must stay stable; older files may lack the optional lists.
 */
export interface ProjectRows {
  project: SqlRow;
  articles: SqlRow[];
  searchHistory: SqlRow[];
  projectDocs: SqlRow[];
  massiveInvs: SqlRow[];
  projCategories: SqlRow[];
  categoryOptions?: SqlRow[];
  articleCategories: SqlRow[];
  categorySelections?: SqlRow[];
  annotations?: SqlRow[];
  highlights?: SqlRow[];
  pendingHighlights?: SqlRow[];
  diaryEntries?: SqlRow[];
  diaryHistory?: SqlRow[];
  questionSets?: SqlRow[];
  investigationResults?: SqlRow[];
}

const CATEGORY_OPTIONS_SQL = `SELECT o.* FROM project_category_options o
  JOIN project_categories c ON o.category_id = c.id WHERE c.project_id = ?`;

/**
 * Reads a project and all of its rows. `includeGlobalQuestionSets` also takes the question sets that
 * belong to no project, so a shared .emmapcarc carries the sets it was built with.
 *
 * Usage:
 *   const rows = readProjectRows(db, projectId, { includeGlobalQuestionSets: true });
 */
export function readProjectRows(
  db: Database.Database,
  projectId: number,
  options: { includeGlobalQuestionSets?: boolean } = {},
): ProjectRows | null {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as SqlRow | undefined;
  if (!project) return null;
  const byProject = (table: string) => rowsOfProject(db, table, projectId);
  const byArticle = (table: string) => rowsOfProject(db, table, projectId, 'article');
  const questionSetsSql = options.includeGlobalQuestionSets
    ? 'SELECT * FROM question_sets WHERE project_id = ? OR project_id IS NULL'
    : 'SELECT * FROM question_sets WHERE project_id = ?';
  return {
    project,
    articles: byProject('articles'),
    searchHistory: byProject('search_history'),
    projectDocs: byProject('project_documents'),
    massiveInvs: byProject('massive_investigations'),
    projCategories: byProject('project_categories'),
    categoryOptions: db.prepare(CATEGORY_OPTIONS_SQL).all(projectId) as SqlRow[],
    articleCategories: byArticle('article_categories'),
    categorySelections: byArticle('article_category_selections'),
    annotations: byArticle('annotations'),
    highlights: byArticle('highlights'),
    pendingHighlights: byArticle('pending_highlights'),
    diaryEntries: byProject('project_diary'),
    diaryHistory: byProject('project_diary_history'),
    questionSets: db.prepare(questionSetsSql).all(projectId) as SqlRow[],
    investigationResults: byArticle('investigation_results'),
  };
}

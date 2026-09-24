import fs from 'fs';
import path from 'path';
import type AdmZip from 'adm-zip';
import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { copyRow, rowsOfProject, type SqlRow } from './rowCopy';

/** Where copied PDFs and project documents are written on this machine. */
export interface StorageDirs {
  pdfs: string;
  documents: string;
}

type IdMap = Map<number, number>;

interface MergeContext {
  active: Database.Database;
  backup: Database.Database;
  zip: AdmZip;
  storage: StorageDirs;
  backupProjectId: number;
  projectId: number;
  ids: Record<'search' | 'article' | 'category' | 'option' | 'investigation' | 'annotation', IdMap>;
}

// Nullable foreign keys whose target was not copied become NULL instead of pointing at an unrelated row.
const remap = (ids: IdMap, id: unknown): number | null => (id == null ? null : (ids.get(Number(id)) ?? null));

/**
 * Copies every project of the backup whose name is not already used into the active database,
 * with all of its rows and stored files. Returns how many projects were imported.
 *
 * Usage:
 *   const imported = mergeBackupProjects(adapter.getDB(), backupAdapter.getDB(), zip, storageDirs);
 */
export function mergeBackupProjects(
  active: Database.Database,
  backup: Database.Database,
  zip: AdmZip,
  storage: StorageDirs,
): number {
  const existing = new Set(
    (active.prepare('SELECT name FROM projects WHERE deleted_at IS NULL').all() as { name: string }[]).map(
      (p) => p.name,
    ),
  );
  const projects = backup.prepare('SELECT * FROM projects WHERE deleted_at IS NULL').all() as SqlRow[];
  const newProjects = projects.filter((p) => !existing.has(String(p.name)));
  for (const project of newProjects) {
    active.transaction(() => mergeProject(active, backup, zip, storage, project))();
  }
  return newProjects.length;
}

function mergeProject(
  active: Database.Database,
  backup: Database.Database,
  zip: AdmZip,
  storage: StorageDirs,
  project: SqlRow,
): void {
  const ctx: MergeContext = {
    active,
    backup,
    zip,
    storage,
    backupProjectId: Number(project.id),
    projectId: copyRow(active, 'projects', project),
    ids: {
      search: new Map(),
      article: new Map(),
      category: new Map(),
      option: new Map(),
      investigation: new Map(),
      annotation: new Map(),
    },
  };
  copySearchHistory(ctx);
  copyArticles(ctx);
  copyDocuments(ctx);
  copyCategories(ctx);
  copyInvestigations(ctx);
  copyAnnotations(ctx);
  copyProjectNotes(ctx);
}

/**
 * Writes the backup's copy of a stored file under a fresh unique name; null when the backup lacks it.
 *
 * Usage:
 *   copyStoredFile(zip, 'storage/pdfs', '/data/storage/pdfs', article.local_file_path);
 */
export function copyStoredFile(zip: AdmZip, zipFolder: string, destDir: string, originalPath: unknown): string | null {
  if (!originalPath) return null;
  const fileName = path.basename(String(originalPath));
  const entry = zip.getEntry(`${zipFolder}/${fileName}`);
  if (!entry) return null;
  const destPath = path.join(destDir, `${uuidv4()}_${fileName}`);
  fs.writeFileSync(destPath, entry.getData());
  return destPath;
}

const rows = (ctx: MergeContext, table: string, via: 'project' | 'article' = 'project') =>
  rowsOfProject(ctx.backup, table, ctx.backupProjectId, via);

function copySearchHistory(ctx: MergeContext): void {
  for (const search of rows(ctx, 'search_history')) {
    ctx.ids.search.set(Number(search.id), copyRow(ctx.active, 'search_history', search, { project_id: ctx.projectId }));
  }
}

function copyArticles(ctx: MergeContext): void {
  for (const article of rows(ctx, 'articles')) {
    const newId = copyRow(ctx.active, 'articles', article, {
      project_id: ctx.projectId,
      search_id: remap(ctx.ids.search, article.search_id),
      local_file_path: copyStoredFile(ctx.zip, 'storage/pdfs', ctx.storage.pdfs, article.local_file_path),
    });
    ctx.ids.article.set(Number(article.id), newId);
  }
}

function copyDocuments(ctx: MergeContext): void {
  for (const doc of rows(ctx, 'project_documents')) {
    copyRow(ctx.active, 'project_documents', doc, {
      project_id: ctx.projectId,
      local_file_path: copyStoredFile(ctx.zip, 'storage/project_documents', ctx.storage.documents, doc.local_file_path),
    });
  }
}

function copyCategories(ctx: MergeContext): void {
  for (const category of rows(ctx, 'project_categories')) {
    ctx.ids.category.set(
      Number(category.id),
      copyRow(ctx.active, 'project_categories', category, { project_id: ctx.projectId }),
    );
  }
  const options = ctx.backup
    .prepare(
      'SELECT o.* FROM project_category_options o JOIN project_categories c ON o.category_id = c.id WHERE c.project_id = ?',
    )
    .all(ctx.backupProjectId) as SqlRow[];
  for (const option of options) {
    const categoryId = remap(ctx.ids.category, option.category_id);
    ctx.ids.option.set(
      Number(option.id),
      copyRow(ctx.active, 'project_category_options', option, { category_id: categoryId }),
    );
  }
  copyArticleLinks(ctx, 'article_categories', {});
  copyArticleLinks(ctx, 'article_category_selections', { option_id: ctx.ids.option });
}

// Rows tying an article to a category are skipped when either side was not copied.
function copyArticleLinks(ctx: MergeContext, table: string, extraIds: Record<string, IdMap>): void {
  for (const link of rows(ctx, table, 'article')) {
    const overrides: SqlRow = {
      article_id: remap(ctx.ids.article, link.article_id),
      category_id: remap(ctx.ids.category, link.category_id),
    };
    for (const [column, ids] of Object.entries(extraIds)) overrides[column] = remap(ids, link[column]);
    if (Object.values(overrides).some((id) => id === null)) continue;
    copyRow(ctx.active, table, link, overrides);
  }
}

function remappedArticleIds(ctx: MergeContext, raw: unknown): unknown {
  try {
    const ids: unknown = JSON.parse(String(raw));
    if (!Array.isArray(ids)) return raw;
    return JSON.stringify(ids.map((id) => ctx.ids.article.get(Number(id))).filter(Boolean));
  } catch {
    return raw;
  }
}

function copyInvestigations(ctx: MergeContext): void {
  for (const investigation of rows(ctx, 'massive_investigations')) {
    const newId = copyRow(ctx.active, 'massive_investigations', investigation, {
      project_id: ctx.projectId,
      articles_ids: remappedArticleIds(ctx, investigation.articles_ids),
    });
    ctx.ids.investigation.set(Number(investigation.id), newId);
  }
  for (const result of rows(ctx, 'investigation_results', 'article')) {
    copyRow(ctx.active, 'investigation_results', result, {
      investigation_id: remap(ctx.ids.investigation, result.investigation_id),
      article_id: remap(ctx.ids.article, result.article_id),
    });
  }
}

function copyAnnotations(ctx: MergeContext): void {
  for (const annotation of rows(ctx, 'annotations', 'article')) {
    const newId = copyRow(ctx.active, 'annotations', annotation, {
      article_id: remap(ctx.ids.article, annotation.article_id),
      // Highlights are copied after annotations, so the old link cannot be restored yet.
      highlight_id: null,
    });
    ctx.ids.annotation.set(Number(annotation.id), newId);
  }
  for (const table of ['highlights', 'pending_highlights']) {
    for (const row of rows(ctx, table, 'article')) {
      copyRow(ctx.active, table, row, {
        article_id: remap(ctx.ids.article, row.article_id),
        annotation_id: remap(ctx.ids.annotation, row.annotation_id),
      });
    }
  }
}

function copyProjectNotes(ctx: MergeContext): void {
  for (const table of ['project_diary', 'project_diary_history', 'question_sets']) {
    for (const row of rows(ctx, table)) {
      copyRow(ctx.active, table, row, { project_id: ctx.projectId });
    }
  }
}

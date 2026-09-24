import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type AdmZip from 'adm-zip';
import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { copyRow, type SqlRow } from './rowCopy';
import type { ProjectRows } from './projectRows';

/** Where an archive keeps the stored files and where they go on this machine. */
export interface StoredFileSource {
  zip: AdmZip;
  pdfFolder: string;
  documentFolder: string;
  pdfDir: string;
  documentDir: string;
}

type IdKind = 'search' | 'article' | 'category' | 'option' | 'investigation' | 'annotation';

interface ImportContext {
  db: Database.Database;
  files: StoredFileSource;
  projectId: number;
  ids: Record<IdKind, Map<number, number>>;
}

const newIdMaps = (): ImportContext['ids'] => ({
  search: new Map(),
  article: new Map(),
  category: new Map(),
  option: new Map(),
  investigation: new Map(),
  annotation: new Map(),
});

// Foreign keys whose target was not imported become NULL instead of pointing at an unrelated row.
const remap = (ctx: ImportContext, kind: IdKind, id: unknown): number | null =>
  id == null ? null : (ctx.ids[kind].get(Number(id)) ?? null);

/**
 * Copies a row whose `required` foreign keys must all resolve; rows left dangling are skipped.
 * Returns the new id, or null when skipped.
 */
function copyLinkedRow(ctx: ImportContext, table: string, row: SqlRow, required: SqlRow, optional: SqlRow = {}) {
  if (Object.values(required).some((id) => id === null)) return null;
  return copyRow(ctx.db, table, row, { ...required, ...optional });
}

/**
 * Inserts a project and all of its rows as a new project named `projectName`, remapping every
 * foreign key and copying stored files from the archive. Runs in one transaction.
 *
 * Usage:
 *   const newId = insertProjectRows(db, rows, files, `${rows.project.name} (Importado)`);
 */
export function insertProjectRows(
  db: Database.Database,
  rows: ProjectRows,
  files: StoredFileSource,
  projectName: string,
): number {
  return db.transaction(() => {
    const ctx: ImportContext = {
      db,
      files,
      projectId: copyRow(db, 'projects', rows.project, { name: projectName }),
      ids: newIdMaps(),
    };
    importSearchesAndArticles(ctx, rows);
    importDocuments(ctx, rows.projectDocs);
    importCategories(ctx, rows);
    importInvestigations(ctx, rows);
    importReadingNotes(ctx, rows);
    importProjectNotes(ctx, rows);
    return ctx.projectId;
  })();
}

function importSearchesAndArticles(ctx: ImportContext, rows: ProjectRows): void {
  for (const search of rows.searchHistory) {
    ctx.ids.search.set(Number(search.id), copyRow(ctx.db, 'search_history', search, { project_id: ctx.projectId }));
  }
  for (const article of rows.articles) {
    const newId = copyRow(ctx.db, 'articles', article, {
      project_id: ctx.projectId,
      search_id: remap(ctx, 'search', article.search_id),
      local_file_path: importPdf(ctx, article.local_file_path),
    });
    ctx.ids.article.set(Number(article.id), newId);
  }
}

const archiveEntry = (files: StoredFileSource, folder: string, originalPath: unknown) =>
  originalPath ? files.zip.getEntry(`${folder}/${path.basename(String(originalPath))}`) : null;

function writeUnique(dir: string, originalPath: unknown, data: Buffer): string {
  const destPath = path.join(dir, `${uuidv4()}_${path.basename(String(originalPath))}`);
  fs.writeFileSync(destPath, data);
  return destPath;
}

// PDFs are deduplicated through the library's content hash, so importing the same file twice stores it once.
function importPdf(ctx: ImportContext, originalPath: unknown): string | null {
  const entry = archiveEntry(ctx.files, ctx.files.pdfFolder, originalPath);
  if (!entry) return null;
  const data = entry.getData();
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  const known = ctx.db.prepare('SELECT file_path FROM pdf_files WHERE file_hash = ?').get(hash) as
    | { file_path: string }
    | undefined;
  if (known && fs.existsSync(known.file_path)) return known.file_path;
  const destPath = writeUnique(ctx.files.pdfDir, originalPath, data);
  ctx.db
    .prepare('INSERT OR REPLACE INTO pdf_files (file_path, file_hash, filename, file_size) VALUES (?, ?, ?, ?)')
    .run(destPath, hash, path.basename(String(originalPath)), data.length);
  return destPath;
}

function importDocuments(ctx: ImportContext, docs: SqlRow[]): void {
  for (const doc of docs) {
    const entry = archiveEntry(ctx.files, ctx.files.documentFolder, doc.local_file_path);
    copyRow(ctx.db, 'project_documents', doc, {
      project_id: ctx.projectId,
      local_file_path: entry ? writeUnique(ctx.files.documentDir, doc.local_file_path, entry.getData()) : null,
    });
  }
}

function importCategories(ctx: ImportContext, rows: ProjectRows): void {
  for (const category of rows.projCategories) {
    ctx.ids.category.set(
      Number(category.id),
      copyRow(ctx.db, 'project_categories', category, { project_id: ctx.projectId }),
    );
  }
  for (const option of rows.categoryOptions ?? []) {
    const newId = copyLinkedRow(ctx, 'project_category_options', option, {
      category_id: remap(ctx, 'category', option.category_id),
    });
    if (newId !== null) ctx.ids.option.set(Number(option.id), newId);
  }
  const articleAndCategory = (link: SqlRow) => ({
    article_id: remap(ctx, 'article', link.article_id),
    category_id: remap(ctx, 'category', link.category_id),
  });
  for (const link of rows.articleCategories) copyLinkedRow(ctx, 'article_categories', link, articleAndCategory(link));
  for (const link of rows.categorySelections ?? []) {
    const required = { ...articleAndCategory(link), option_id: remap(ctx, 'option', link.option_id) };
    copyLinkedRow(ctx, 'article_category_selections', link, required);
  }
}

function remappedArticleIds(ctx: ImportContext, raw: unknown): unknown {
  try {
    const ids: unknown = JSON.parse(String(raw));
    if (!Array.isArray(ids)) return raw;
    return JSON.stringify(ids.map((id) => ctx.ids.article.get(Number(id))).filter(Boolean));
  } catch {
    return raw;
  }
}

function importInvestigations(ctx: ImportContext, rows: ProjectRows): void {
  for (const investigation of rows.massiveInvs) {
    const newId = copyRow(ctx.db, 'massive_investigations', investigation, {
      project_id: ctx.projectId,
      articles_ids: remappedArticleIds(ctx, investigation.articles_ids),
    });
    ctx.ids.investigation.set(Number(investigation.id), newId);
  }
  for (const result of rows.investigationResults ?? []) {
    copyLinkedRow(ctx, 'investigation_results', result, {
      investigation_id: remap(ctx, 'investigation', result.investigation_id),
      article_id: remap(ctx, 'article', result.article_id),
    });
  }
}

function importReadingNotes(ctx: ImportContext, rows: ProjectRows): void {
  for (const annotation of rows.annotations ?? []) {
    // Highlights are imported after annotations, so the annotation → highlight link starts empty.
    const newId = copyLinkedRow(
      ctx,
      'annotations',
      annotation,
      { article_id: remap(ctx, 'article', annotation.article_id) },
      { highlight_id: null },
    );
    if (newId !== null) ctx.ids.annotation.set(Number(annotation.id), newId);
  }
  for (const highlight of rows.highlights ?? []) {
    const article = { article_id: remap(ctx, 'article', highlight.article_id) };
    copyLinkedRow(ctx, 'highlights', highlight, article, {
      annotation_id: remap(ctx, 'annotation', highlight.annotation_id),
    });
  }
  for (const pending of rows.pendingHighlights ?? []) {
    copyLinkedRow(ctx, 'pending_highlights', pending, { article_id: remap(ctx, 'article', pending.article_id) });
  }
}

// Global question sets from the archive are imported into this project to avoid clashing with local ones.
function importProjectNotes(ctx: ImportContext, rows: ProjectRows): void {
  const tables: [string, SqlRow[] | undefined][] = [
    ['project_diary', rows.diaryEntries],
    ['project_diary_history', rows.diaryHistory],
    ['question_sets', rows.questionSets],
  ];
  for (const [table, tableRows] of tables) {
    for (const row of tableRows ?? []) copyRow(ctx.db, table, row, { project_id: ctx.projectId });
  }
}

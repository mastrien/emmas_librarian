import fs from 'fs';
import path from 'path';
import { IpcChannel, type Article } from '../../types';
import type { ArticleInput, DatabaseAdapter } from '../../database/DatabaseAdapter';
import { handle, type IpcRegistrar } from './handle';
import { ensureStorageDir, savePdfToStorage } from './pdfStorage';

type ManualArticleData = Partial<Omit<Article, 'year'>> & { title: string; year?: string | number };

const MANUAL_SOURCES = JSON.stringify(['Manual']);

/**
 * Article queries, metadata/status updates, cross-project import and manual/PDF-based creation.
 *
 * Usage:
 *   registerArticleHandlers(ipcMain, db);
 */
export function registerArticleHandlers(ipc: IpcRegistrar, db: DatabaseAdapter): void {
  handle(ipc, IpcChannel.ARTICLES_GET_BY_PROJECT, (_e, projectId: number) => db.getArticlesByProject(projectId));
  handle(ipc, IpcChannel.ARTICLES_GET_ONE, (_e, id: number) => db.getArticle(id));
  handle(ipc, IpcChannel.ARTICLES_UPDATE_STATUS, (_e, id: number, status: Article['status'], note?: string) =>
    db.updateArticleStatus(id, status, note),
  );
  handle(ipc, IpcChannel.ARTICLES_UPDATE_METADATA, (_e, id: number, data: Partial<ArticleInput>) =>
    db.updateArticleMetadata(id, data),
  );
  handle(ipc, IpcChannel.ARTICLES_IMPORT_FROM_PROJECT, (_e, sourceId: number, destId: number, articleIds: number[]) =>
    importFromProject(db, sourceId, destId, articleIds),
  );
  handle(
    ipc,
    IpcChannel.ARTICLES_CREATE_MANUAL,
    (_e, projectId: number, data: ManualArticleData, sourceFilePath?: string) =>
      createManualArticle(db, projectId, data, sourceFilePath),
  );
  handle(ipc, IpcChannel.ARTICLES_CREATE_FROM_PDFS, (_e, projectId: number, filePaths: string[]) =>
    createArticlesFromPdfs(db, projectId, filePaths),
  );
}

function importFromProject(db: DatabaseAdapter, sourceProjectId: number, destProjectId: number, articleIds: number[]) {
  const sourceName = db.getProject(sourceProjectId)?.name ?? `Projeto ID ${sourceProjectId}`;
  const searchId = db.saveSearchHistory(
    destProjectId,
    `Importação de artigos do projeto '${sourceName}'`,
    { import: `Origem: Projeto ID ${sourceProjectId}` },
    articleIds.length,
    { import: { count: articleIds.length } },
  );
  db.importArticlesFromProject(sourceProjectId, destProjectId, articleIds, searchId);
  return searchId;
}

function createManualArticle(db: DatabaseAdapter, projectId: number, data: ManualArticleData, sourceFilePath?: string) {
  const searchId = logToHistory('Failed to log manual article creation to search history:', () =>
    db.saveSearchHistory(projectId, `Adição manual de artigo avulso: ${data.title}`, {}, 1, { Manual: { count: 1 } }),
  );
  const articleId = db.saveArticle(projectId, {
    title: data.title,
    authors: data.authors || '',
    year: data.year ? parseInt(String(data.year)) : undefined,
    doi: data.doi || undefined,
    abstract: data.abstract || undefined,
    journal: data.journal || undefined,
    source_query: 'Manual Import',
    source_databases: MANUAL_SOURCES,
    csl_json: JSON.stringify({}),
    search_id: searchId,
  });
  if (sourceFilePath) attachCopiedPdf(db, articleId, sourceFilePath);
  return articleId;
}

function attachCopiedPdf(db: DatabaseAdapter, articleId: number, sourceFilePath: string): void {
  try {
    const destPath = path.join(ensureStorageDir('pdfs'), `${articleId}_${Date.now()}.pdf`);
    fs.copyFileSync(sourceFilePath, destPath);
    db.updateArticleFilePath(articleId, destPath);
  } catch (err) {
    console.error('Failed to copy PDF file for manual article:', err);
  }
}

function createArticlesFromPdfs(db: DatabaseAdapter, projectId: number, filePaths: string[]): number {
  const searchId =
    filePaths.length > 0
      ? logToHistory('Failed to log batch import to search history:', () =>
          db.saveSearchHistory(projectId, `Importação em Lote de ${filePaths.length} PDFs`, {}, filePaths.length, {
            Manual: { count: filePaths.length },
          }),
        )
      : undefined;
  ensureStorageDir('pdfs');
  return filePaths.filter((filePath) => importPdfAsArticle(db, projectId, filePath, searchId)).length;
}

// Store the PDF first so a failed copy never leaves an article without its file.
function importPdfAsArticle(
  db: DatabaseAdapter,
  projectId: number,
  sourceFilePath: string,
  searchId?: number,
): boolean {
  try {
    const { destPath } = savePdfToStorage(db, sourceFilePath);
    const articleId = db.saveArticle(projectId, {
      title: path.basename(sourceFilePath, '.pdf'),
      authors: '',
      source_query: 'Importação em Lote',
      source_databases: MANUAL_SOURCES,
      csl_json: JSON.stringify({}),
      search_id: searchId,
    });
    db.linkPdfToArticle(articleId, destPath);
    return true;
  } catch (err) {
    console.error('Failed to copy PDF file for batch import:', err);
    return false;
  }
}

// History entries are best-effort: a failure to log must not block the article itself.
function logToHistory(failureMessage: string, save: () => number): number | undefined {
  try {
    return save();
  } catch (err) {
    console.error(failureMessage, err);
    return undefined;
  }
}

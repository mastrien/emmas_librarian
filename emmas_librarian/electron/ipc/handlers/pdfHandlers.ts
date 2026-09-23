import fs from 'fs';
import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { handle, type IpcRegistrar } from './handle';
import { savePdfToStorage } from './pdfStorage';

/**
 * Article PDFs and the global PDF library (upload, read, link, unlink, delete).
 *
 * Usage:
 *   registerPdfHandlers(ipcMain, db);
 */
export function registerPdfHandlers(ipc: IpcRegistrar, db: DatabaseAdapter): void {
  handle(ipc, IpcChannel.PDF_UPLOAD, (_e, articleId: number, sourceFilePath: string) => {
    const { destPath } = savePdfToStorage(db, sourceFilePath);
    db.linkPdfToArticle(articleId, destPath);
    return destPath;
  });
  handle(ipc, IpcChannel.PDF_GET, (_e, articleId: number) => readArticlePdf(db, articleId));
  handle(ipc, IpcChannel.PDF_UNLINK, (_e, articleId: number) => unlinkArticlePdf(db, articleId));

  handle(ipc, IpcChannel.PDF_LIBRARY_LIST, () => db.getStoredPdfs());
  handle(ipc, IpcChannel.PDF_LIBRARY_DELETE, (_e, filePath: string) => {
    const articleIds = db.deletePdfLibraryRecord(filePath);
    deleteFileIfPresent(filePath);
    return articleIds;
  });
  handle(ipc, IpcChannel.PDF_LIBRARY_LINK, (_e, articleId: number, filePath: string) => {
    db.linkPdfToArticle(articleId, filePath);
  });
  handle(ipc, IpcChannel.PDF_LIBRARY_UPLOAD, (_e, sourceFilePath: string) => savePdfToStorage(db, sourceFilePath).destPath);
}

function readArticlePdf(db: DatabaseAdapter, articleId: number): Buffer {
  const filePath = db.getArticle(articleId)?.local_file_path;
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(
      `[ERR_NOT_FOUND] PDF não encontrado. Offending value: articleId=${articleId}. Expected shape: ID de artigo com arquivo PDF existente em disco.`,
    );
  }
  return fs.readFileSync(filePath);
}

// The file is shared by content hash, so it is only deleted once no article references it.
function unlinkArticlePdf(db: DatabaseAdapter, articleId: number): void {
  const filePath = db.getArticle(articleId)?.local_file_path;
  if (!filePath) return;
  db.unlinkPdfFromArticle(articleId);
  if (db.getArticlesForPdf(filePath).length > 0) return;
  if (deleteFileIfPresent(filePath)) db.deletePdfRecord(filePath);
}

/** Deletes a file if it exists; returns whether it was removed. Failures are logged, not thrown. */
function deleteFileIfPresent(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (err) {
    console.error('Failed to delete physical PDF file:', err);
    return false;
  }
}

import fs from 'fs';
import { IpcChannel } from '../../src/types';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { CommandRegistry } from './CommandRegistry';
import type { LibraryStorage } from '../services/LibraryStorage';
import type { OpenAccessService } from '../services/openAccess/OpenAccessService';
import { openAccessServiceFor } from '../services/openAccess/openAccessServiceFor';

/**
 * Article PDFs and the global PDF library (upload, read, link, unlink, delete).
 *
 * Usage:
 *   registerPdfCommands(commands, db, storage);
 */
export function registerPdfCommands(
  commands: CommandRegistry,
  db: DatabaseAdapter,
  storage: LibraryStorage,
  openAccess: Pick<OpenAccessService, 'fetchForArticle'> = openAccessServiceFor(db, storage, process.env),
): void {
  commands.add(IpcChannel.PDF_UPLOAD, (articleId: number, sourceFilePath: string) => {
    const { destPath } = storage.savePdf(sourceFilePath);
    db.linkPdfToArticle(articleId, destPath);
    return destPath;
  });
  commands.add(IpcChannel.PDF_GET, (articleId: number) => readArticlePdf(db, articleId));
  commands.add(IpcChannel.PDF_UNLINK, (articleId: number) => unlinkArticlePdf(db, articleId));
  commands.add(IpcChannel.PDF_FETCH_OPEN_ACCESS, (articleId: number) => openAccess.fetchForArticle(articleId));

  commands.add(IpcChannel.PDF_LIBRARY_LIST, () => db.getStoredPdfs());
  commands.add(IpcChannel.PDF_LIBRARY_DELETE, (filePath: string) => {
    const articleIds = db.deletePdfLibraryRecord(filePath);
    deleteFileIfPresent(filePath);
    return articleIds;
  });
  commands.add(IpcChannel.PDF_LIBRARY_LINK, (articleId: number, filePath: string) => {
    db.linkPdfToArticle(articleId, filePath);
  });
  commands.add(IpcChannel.PDF_LIBRARY_UPLOAD, (sourceFilePath: string) => storage.savePdf(sourceFilePath).destPath);
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

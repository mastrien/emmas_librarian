import fs from 'fs';
import path from 'path';
import { shell } from 'electron';
import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../../core/database/DatabaseAdapter';
import { handle, type IpcRegistrar } from './handle';
import type { LibraryStorage } from '../../../core/services/LibraryStorage';

type Optional<T> = T | null | undefined;

/**
 * Project reference documents (links and/or files copied into app storage).
 *
 * Usage:
 *   registerDocumentHandlers(ipcMain, db, storage);
 */
export function registerDocumentHandlers(ipc: IpcRegistrar, db: DatabaseAdapter, storage: LibraryStorage): void {
  handle(ipc, IpcChannel.PROJECT_DOCUMENTS_GET, (_e, projectId: number) => db.getProjectDocuments(projectId));
  handle(
    ipc,
    IpcChannel.PROJECT_DOCUMENTS_CREATE,
    (
      _e,
      projectId: number,
      title: string,
      url?: Optional<string>,
      sourceFilePath?: Optional<string>,
      category?: Optional<string>,
    ) => {
      const stored = sourceFilePath
        ? copyIntoDocuments(storage, sourceFilePath, `doc_${projectId}_${Date.now()}.pdf`, 'project document')
        : null;
      return db.saveProjectDocument(projectId, title, url ?? null, stored, category ?? null);
    },
  );
  handle(
    ipc,
    IpcChannel.PROJECT_DOCUMENTS_UPDATE,
    (
      _e,
      id: number,
      title: string,
      url?: Optional<string>,
      sourceFilePath?: Optional<string>,
      category?: Optional<string>,
    ) =>
      db.updateProjectDocument(id, title, url ?? null, resolveUpdatedFile(storage, sourceFilePath), category ?? null),
  );
  handle(ipc, IpcChannel.PROJECT_DOCUMENTS_REORDER, (_e, projectId: number, orderedIds?: number[] | null) =>
    db.reorderProjectDocuments(projectId, orderedIds || []),
  );
  handle(ipc, IpcChannel.PROJECT_DOCUMENTS_DELETE, (_e, id: number) => db.deleteProjectDocument(id));
  handle(ipc, IpcChannel.PROJECT_DOCUMENTS_MARK_OPENED, (_e, id: number) => db.markProjectDocumentOpened(id));
  handle(ipc, IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL, (_e, url?: string, filePath?: string) =>
    openDocument(url, filePath),
  );
}

// A path already inside project storage was copied before; anything else is a newly attached external file.
function resolveUpdatedFile(storage: LibraryStorage, sourceFilePath: Optional<string>): string | null {
  if (!sourceFilePath || sourceFilePath.includes(path.join('storage', 'project_documents')))
    return sourceFilePath ?? null;
  const storedName = `doc_${Date.now()}.pdf`;
  return copyIntoDocuments(storage, sourceFilePath, storedName, 'updating project document') ?? sourceFilePath;
}

/** Copies a file into project storage; returns the stored path, or null when the copy failed. */
function copyIntoDocuments(
  storage: LibraryStorage,
  sourceFilePath: string,
  storedName: string,
  purpose: string,
): string | null {
  try {
    const storedPath = path.join(storage.documentsDir(), storedName);
    fs.copyFileSync(sourceFilePath, storedPath);
    return storedPath;
  } catch (err) {
    console.error(`Failed to copy PDF file for ${purpose}:`, err);
    return null;
  }
}

async function openDocument(url?: string, filePath?: string): Promise<void> {
  const localFile = filePath && fs.existsSync(filePath) ? filePath : undefined;
  const target = localFile ?? url;
  if (!target) return;
  // E2E: note the target instead of launching a browser or another app on the test machine.
  const openLog = process.env.E2E_MOCK_OPEN_EXTERNAL_LOG;
  if (openLog) return fs.appendFileSync(openLog, `${target}\n`);
  await (localFile ? shell.openPath(localFile) : shell.openExternal(target));
}

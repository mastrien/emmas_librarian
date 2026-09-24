import fs from 'fs';
import path from 'path';
import { shell } from 'electron';
import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { handle, type IpcRegistrar } from './handle';
import { ensureStorageDir } from './pdfStorage';

type Optional<T> = T | null | undefined;

/**
 * Project reference documents (links and/or files copied into app storage).
 *
 * Usage:
 *   registerDocumentHandlers(ipcMain, db);
 */
export function registerDocumentHandlers(ipc: IpcRegistrar, db: DatabaseAdapter): void {
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
        ? copyIntoDocuments(sourceFilePath, `doc_${projectId}_${Date.now()}.pdf`, 'project document')
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
    ) => db.updateProjectDocument(id, title, url ?? null, resolveUpdatedFile(sourceFilePath), category ?? null),
  );
  handle(ipc, IpcChannel.PROJECT_DOCUMENTS_REORDER, (_e, projectId: number, orderedIds?: number[] | null) =>
    db.reorderProjectDocuments(projectId, orderedIds || []),
  );
  handle(ipc, IpcChannel.PROJECT_DOCUMENTS_DELETE, (_e, id: number) => db.deleteProjectDocument(id));
  handle(ipc, IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL, (_e, url?: string, filePath?: string) =>
    openDocument(url, filePath),
  );
}

// A path already inside project storage was copied before; anything else is a newly attached external file.
function resolveUpdatedFile(sourceFilePath: Optional<string>): string | null {
  if (!sourceFilePath || sourceFilePath.includes(path.join('storage', 'project_documents')))
    return sourceFilePath ?? null;
  return copyIntoDocuments(sourceFilePath, `doc_${Date.now()}.pdf`, 'updating project document') ?? sourceFilePath;
}

/** Copies a file into project storage; returns the stored path, or null when the copy failed. */
function copyIntoDocuments(sourceFilePath: string, storedName: string, purpose: string): string | null {
  try {
    const storedPath = path.join(ensureStorageDir('project_documents'), storedName);
    fs.copyFileSync(sourceFilePath, storedPath);
    return storedPath;
  } catch (err) {
    console.error(`Failed to copy PDF file for ${purpose}:`, err);
    return null;
  }
}

async function openDocument(url?: string, filePath?: string): Promise<void> {
  if (filePath && fs.existsSync(filePath)) {
    await shell.openPath(filePath);
  } else if (url) {
    await shell.openExternal(url);
  }
}

import fs from 'fs';
import path from 'path';
import { IpcChannel } from '../../src/types';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { CommandRegistry } from './CommandRegistry';
import type { LibraryStorage } from '../services/LibraryStorage';

type Optional<T> = T | null | undefined;

/**
 * Project reference documents (links and/or files copied into app storage).
 *
 * Usage:
 *   registerDocumentCommands(commands, db, storage);
 */
export function registerDocumentCommands(
  commands: CommandRegistry,
  db: DatabaseAdapter,
  storage: LibraryStorage,
): void {
  commands.add(IpcChannel.PROJECT_DOCUMENTS_GET, (projectId: number) => db.getProjectDocuments(projectId));
  commands.add(
    IpcChannel.PROJECT_DOCUMENTS_CREATE,
    (
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
  commands.add(
    IpcChannel.PROJECT_DOCUMENTS_UPDATE,
    (
      id: number,
      title: string,
      url?: Optional<string>,
      sourceFilePath?: Optional<string>,
      category?: Optional<string>,
    ) =>
      db.updateProjectDocument(id, title, url ?? null, resolveUpdatedFile(storage, sourceFilePath), category ?? null),
  );
  commands.add(IpcChannel.PROJECT_DOCUMENTS_REORDER, (projectId: number, orderedIds?: number[] | null) =>
    db.reorderProjectDocuments(projectId, orderedIds || []),
  );
  commands.add(IpcChannel.PROJECT_DOCUMENTS_DELETE, (id: number) => db.deleteProjectDocument(id));
  commands.add(IpcChannel.PROJECT_DOCUMENTS_MARK_OPENED, (id: number) => db.markProjectDocumentOpened(id));
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

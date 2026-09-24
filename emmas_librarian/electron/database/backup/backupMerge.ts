import type AdmZip from 'adm-zip';
import type Database from 'better-sqlite3';
import { readProjectRows } from './projectRows';
import { insertProjectRows } from './projectImport';

/** Where copied PDFs and project documents are written on this machine. */
export interface StorageDirs {
  pdfs: string;
  documents: string;
}

const activeProjectNames = (db: Database.Database) =>
  new Set(
    (db.prepare('SELECT name FROM projects WHERE deleted_at IS NULL').all() as { name: string }[]).map((p) => p.name),
  );

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
  const existing = activeProjectNames(active);
  const projects = backup.prepare('SELECT id, name FROM projects WHERE deleted_at IS NULL').all() as {
    id: number;
    name: string;
  }[];
  const newProjects = projects.filter((p) => !existing.has(p.name));
  const files = {
    zip,
    pdfFolder: 'storage/pdfs',
    documentFolder: 'storage/project_documents',
    pdfDir: storage.pdfs,
    documentDir: storage.documents,
  };
  for (const project of newProjects) {
    insertProjectRows(active, readProjectRows(backup, project.id)!, files, project.name);
  }
  return newProjects.length;
}

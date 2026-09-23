import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';

export interface StoredPdf {
  destPath: string;
  hash: string;
  filename: string;
  size: number;
}

/**
 * Returns `<userData>/storage/<segments>`, creating it when missing.
 *
 * Usage:
 *   const pdfsDir = ensureStorageDir('pdfs');
 */
export function ensureStorageDir(...segments: string[]): string {
  const dir = path.join(app.getPath('userData'), 'storage', ...segments);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Copies a PDF into the global library (deduplicated by content hash) and registers it.
 *
 * Usage:
 *   const { destPath } = savePdfToStorage(db, '/downloads/paper.pdf');
 */
export function savePdfToStorage(db: DatabaseAdapter, sourceFilePath: string): StoredPdf {
  const hash = hashFile(sourceFilePath);
  const pdfsDir = ensureStorageDir('pdfs');
  const { destPath, filename } = reuseStoredCopy(db, hash) ?? copyIntoLibrary(sourceFilePath, pdfsDir);
  const size = fs.statSync(destPath).size;
  db.registerPdfInLibrary(destPath, hash, filename, size);
  return { destPath, hash, filename, size };
}

function hashFile(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function reuseStoredCopy(db: DatabaseAdapter, hash: string): { destPath: string; filename: string } | null {
  const existing = db.getPdfByHash(hash);
  if (!existing?.file_path || !fs.existsSync(existing.file_path)) return null;
  return { destPath: existing.file_path, filename: existing.filename || path.basename(existing.file_path) };
}

function copyIntoLibrary(sourceFilePath: string, pdfsDir: string): { destPath: string; filename: string } {
  const filename = timestampedFilename(sourceFilePath);
  const destPath = path.join(pdfsDir, filename);
  if (!fs.existsSync(destPath)) {
    fs.copyFileSync(sourceFilePath, destPath);
  }
  return { destPath, filename };
}

// Date + time prefix keeps same-named uploads apart; the original name is sanitized for the filesystem.
function timestampedFilename(sourceFilePath: string): string {
  const originalName = path.basename(sourceFilePath).replace(/[^a-zA-Z0-9._-]/g, '_');
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10);
  const timeStamp = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `${dateStamp}_${timeStamp}_${originalName}`;
}

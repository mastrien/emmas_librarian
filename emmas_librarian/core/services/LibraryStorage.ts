import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { AppPaths } from '../ports/AppPaths';
import { localIsoDate } from '../../src/utils/localDate';

export interface StoredPdf {
  destPath: string;
  hash: string;
  filename: string;
  size: number;
}

/** The part of the app database the stored files are registered in. */
export type PdfRegistry = Pick<DatabaseAdapter, 'registerPdfInLibrary' | 'getPdfByHash'>;

function ensureDir(dir: string): string {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * The files the library keeps on disk: the PDFs shared between projects (deduplicated by content
 * hash) and the documents attached to projects.
 *
 * Usage:
 *   const storage = new LibraryStorage(db, appPathsIn(userData));
 *   const { destPath } = storage.savePdf('/downloads/paper.pdf');
 */
export class LibraryStorage {
  constructor(
    private db: PdfRegistry,
    private paths: Pick<AppPaths, 'pdfsDir' | 'documentsDir'>,
  ) {}

  /** The folder of the PDF library, created when missing. */
  public pdfsDir(): string {
    return ensureDir(this.paths.pdfsDir);
  }

  /** The folder of project documents, created when missing. */
  public documentsDir(): string {
    return ensureDir(this.paths.documentsDir);
  }

  /** Copies a PDF into the library (reusing a stored copy with the same content) and registers it. */
  public savePdf(sourceFilePath: string): StoredPdf {
    const hash = hashFile(sourceFilePath);
    const pdfsDir = this.pdfsDir();
    const { destPath, filename } = reuseStoredCopy(this.db, hash) ?? copyIntoLibrary(sourceFilePath, pdfsDir);
    const size = fs.statSync(destPath).size;
    this.db.registerPdfInLibrary(destPath, hash, filename, size);
    return { destPath, hash, filename, size };
  }

  /**
   * Stores downloaded PDF bytes in the library, reusing a stored copy with the same content hash, and
   * registers it; `originalName` becomes the (timestamped) file name.
   *
   * Usage:
   *   const { destPath } = storage.savePdfBytes(bytes, '10.2337_dc11-s062.pdf');
   */
  public savePdfBytes(bytes: Buffer, originalName: string): StoredPdf {
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const pdfsDir = this.pdfsDir();
    const { destPath, filename } = reuseStoredCopy(this.db, hash) ?? writeIntoLibrary(bytes, originalName, pdfsDir);
    this.db.registerPdfInLibrary(destPath, hash, filename, bytes.length);
    return { destPath, hash, filename, size: bytes.length };
  }
}

function writeIntoLibrary(
  bytes: Buffer,
  originalName: string,
  pdfsDir: string,
): { destPath: string; filename: string } {
  const filename = timestampedFilename(originalName);
  const destPath = path.join(pdfsDir, filename);
  if (!fs.existsSync(destPath)) fs.writeFileSync(destPath, bytes);
  return { destPath, filename };
}

function hashFile(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function reuseStoredCopy(db: PdfRegistry, hash: string): { destPath: string; filename: string } | null {
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
  const dateStamp = localIsoDate(now);
  const timeStamp = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `${dateStamp}_${timeStamp}_${originalName}`;
}

import fs from 'fs';
import type Database from 'better-sqlite3';

/**
 * True while some article still points at the file: of any project, trashed ones included, since they can be
 * restored. A copy from another project and the library's one-file-per-content share a PDF (#68).
 *
 * @example isPdfStillUsed(db, '/lib/a.pdf') // true while another article links it
 */
export function isPdfStillUsed(db: Database.Database, filePath: string): boolean {
  return db.prepare('SELECT 1 FROM articles WHERE local_file_path = ? LIMIT 1').get(filePath) !== undefined;
}

/**
 * Deletes a PDF from disk, and its library record, once no article points at it anymore; a file another
 * article still uses stays. Call it after the rows that used the file were deleted or changed. A failure to
 * delete is logged with `owner` ("article 12"), never thrown, as before (#68).
 *
 * @example
 *   db.prepare('DELETE FROM articles WHERE id = ?').run(id);
 *   deletePdfIfUnused(db, oldPath, `article ${id}`);
 */
export function deletePdfIfUnused(db: Database.Database, filePath: string | null | undefined, owner: string): void {
  if (!filePath || isPdfStillUsed(db, filePath)) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM pdf_files WHERE file_path = ?').run(filePath);
  } catch (err) {
    console.error(`Failed to delete physical PDF for ${owner}:`, err);
  }
}

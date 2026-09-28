import fs from 'fs';
import type AdmZip from 'adm-zip';

/**
 * Writes `zip` to `filePath`, throwing when the file cannot be written. AdmZip.writeZip returns silently when
 * the target is a folder, which made exports report success for a file that was never written.
 *
 * Usage:
 *   writeArchive(zip, 'C:/backups/backup_2026-09-28.emmabak');
 */
export function writeArchive(zip: AdmZip, filePath: string): void {
  fs.writeFileSync(filePath, zip.toBuffer());
}

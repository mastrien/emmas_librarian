import type { BackupService } from '../core/services/BackupService';

/** The part of the automatic backups the startup uses. */
export type StartupBackups = Pick<BackupService, 'runAutoBackup' | 'rotateBackups'>;

/**
 * Creates today's automatic backup and rotates old ones without delaying startup.
 * Rotation runs even if the backup fails, and neither failure is fatal.
 *
 * Usage:
 *   scheduleStartupBackup(backupService);
 */
export function scheduleStartupBackup(backups: StartupBackups): void {
  Promise.resolve().then(async () => {
    try {
      const backupPath = await backups.runAutoBackup();
      if (backupPath) console.log(`Auto backup created successfully at: ${backupPath}`);
    } catch (err) {
      console.error('Auto backup failed:', err);
    } finally {
      rotateSafely(backups);
    }
  });
}

function rotateSafely(backups: StartupBackups): void {
  try {
    backups.rotateBackups();
  } catch (err) {
    console.error('Backup rotation failed:', err);
  }
}

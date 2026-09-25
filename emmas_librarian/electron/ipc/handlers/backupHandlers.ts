import { app } from 'electron';
import { IpcChannel } from '../../types';
import type { SyncService } from '../../database/SyncService';
import type { BackupService } from '../../services/BackupService';
import { handle, type IpcRegistrar } from './handle';

/**
 * Project sharing (export/import), manual and automatic backups, and the app version.
 *
 * Usage:
 *   registerBackupHandlers(ipcMain, syncService, backupService);
 */
export function registerBackupHandlers(ipc: IpcRegistrar, sync: SyncService, backups: BackupService): void {
  handle(ipc, IpcChannel.SYNC_EXPORT_PROJECT, (_e, projectId: number) => sync.exportProject(projectId));
  handle(ipc, IpcChannel.SYNC_IMPORT_PROJECT, (_e, filePath?: string) => sync.importProject(filePath));
  handle(ipc, IpcChannel.BACKUP_EXPORT, () => sync.exportBackup());
  handle(ipc, IpcChannel.BACKUP_RESTORE_OVERRIDE, () => sync.restoreBackupOverride());
  handle(ipc, IpcChannel.BACKUP_RESTORE_MERGE, () => sync.restoreBackupMerge());
  handle(ipc, IpcChannel.BACKUP_LIST_AUTO, () => backups.listAutoBackups());
  handle(ipc, IpcChannel.BACKUP_RESTORE_AUTO, (_e, filename: string) => backups.restoreAutoBackup(filename));
  handle(ipc, IpcChannel.APP_GET_VERSION, () => app.getVersion());
}

/**
 * Creates today's automatic backup and rotates old ones without delaying startup.
 * Rotation runs even if the backup fails, and neither failure is fatal.
 *
 * Usage:
 *   scheduleStartupBackup(backupService);
 */
export function scheduleStartupBackup(backups: BackupService): void {
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

function rotateSafely(backups: BackupService): void {
  try {
    backups.rotateBackups();
  } catch (err) {
    console.error('Backup rotation failed:', err);
  }
}

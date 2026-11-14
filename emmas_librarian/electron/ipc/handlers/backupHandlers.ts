import { IpcChannel } from '../../types';
import type { SyncService } from '../../../core/database/SyncService';
import type { BackupService } from '../../../core/services/BackupService';
import type { FilePicker } from '../../ports/FilePicker';
import { localIsoDate } from '../../../src/utils/localDate';
import { handle, type IpcRegistrar } from './handle';

const PROJECT_FILTERS = [{ name: "Emma's Librarian Project", extensions: ['emmapcarc'] }];
const BACKUP_FILTERS = [{ name: "Emma's Librarian Backup", extensions: ['emmabak'] }];

/** The part of each service these handlers call, so tests can stand in for them with named fakes. */
export type LibraryFiles = Pick<
  SyncService,
  'exportProject' | 'importProject' | 'exportBackup' | 'restoreBackupOverride' | 'restoreBackupMerge'
>;
export type AutoBackups = Pick<BackupService, 'listAutoBackups' | 'restoreAutoBackup'>;

export interface LibraryFileServices {
  sync: LibraryFiles;
  backups: AutoBackups;
  picker: FilePicker;
  appVersion: string;
}

/**
 * Project sharing (export/import), manual and automatic backups, and the app version.
 *
 * The services receive the file; choosing it (a native dialog here) is this shell's part. A cancelled
 * dialog answers null, or false for the restore that replaces everything, and nothing is touched.
 *
 * Usage:
 *   registerBackupHandlers(ipcMain, { sync, backups, picker, appVersion: app.getVersion() });
 */
export function registerBackupHandlers(ipc: IpcRegistrar, services: LibraryFileServices): void {
  const { sync, backups, picker, appVersion } = services;
  registerProjectFileHandlers(ipc, sync, picker);
  registerFullBackupHandlers(ipc, sync, picker);
  handle(ipc, IpcChannel.BACKUP_LIST_AUTO, () => backups.listAutoBackups());
  handle(ipc, IpcChannel.BACKUP_RESTORE_AUTO, (_e, filename: string) => backups.restoreAutoBackup(filename));
  handle(ipc, IpcChannel.APP_GET_VERSION, () => appVersion);
}

function registerProjectFileHandlers(ipc: IpcRegistrar, sync: LibraryFiles, picker: FilePicker): void {
  handle(ipc, IpcChannel.SYNC_EXPORT_PROJECT, async (_e, projectId: number) => {
    const target = await picker.chooseSavePath({
      title: 'Exportar Projeto',
      defaultPath: `projeto_${projectId}.emmapcarc`,
      filters: PROJECT_FILTERS,
    });
    return target ? sync.exportProject(projectId, target) : null;
  });
  handle(ipc, IpcChannel.SYNC_IMPORT_PROJECT, async (_e, filePath?: string) => {
    const source = filePath ?? (await chooseProjectFile(picker));
    return source ? sync.importProject(source) : null;
  });
}

const chooseProjectFile = (picker: FilePicker) =>
  picker.chooseFile({ title: 'Importar Projeto', filters: PROJECT_FILTERS, answeredInE2EBy: 'E2E_MOCK_PROJECT_FILE' });

const chooseBackupFile = (picker: FilePicker, title: string) =>
  picker.chooseFile({ title, filters: BACKUP_FILTERS, answeredInE2EBy: 'E2E_MOCK_BACKUP_FILE' });

function registerFullBackupHandlers(ipc: IpcRegistrar, sync: LibraryFiles, picker: FilePicker): void {
  handle(ipc, IpcChannel.BACKUP_EXPORT, async () => {
    const target = await picker.chooseSavePath({
      title: 'Exportar Backup Completo',
      defaultPath: `backup_${localIsoDate()}.emmabak`,
      filters: BACKUP_FILTERS,
    });
    return target ? sync.exportBackup(target) : null;
  });
  handle(ipc, IpcChannel.BACKUP_RESTORE_OVERRIDE, async () => {
    const source = await chooseBackupFile(picker, 'Restaurar Backup Completo (Sobrescrever)');
    return source ? sync.restoreBackupOverride(source) : false;
  });
  // null, not 0, for a cancel: the UI must not report "no new project" when nothing was tried.
  handle(ipc, IpcChannel.BACKUP_RESTORE_MERGE, async () => {
    const source = await chooseBackupFile(picker, 'Importar e Mesclar Backup');
    return source ? sync.restoreBackupMerge(source) : null;
  });
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

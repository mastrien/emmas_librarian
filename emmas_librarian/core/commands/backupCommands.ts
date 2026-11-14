import { IpcChannel } from '../../src/types';
import type { SyncService } from '../database/SyncService';
import type { BackupService } from '../services/BackupService';
import { localIsoDate } from '../../src/utils/localDate';
import type { CommandRegistry, FileSuggestion } from './CommandRegistry';

const PROJECT_FILTERS = [{ name: "Emma's Librarian Project", extensions: ['emmapcarc'] }];
const BACKUP_FILTERS = [{ name: "Emma's Librarian Backup", extensions: ['emmabak'] }];

/** The part of each service these commands call, so tests can stand in for them with named fakes. */
export type LibraryFiles = Pick<
  SyncService,
  'exportProject' | 'importProject' | 'exportBackup' | 'restoreBackupOverride' | 'restoreBackupMerge'
>;
export type AutoBackups = Pick<BackupService, 'listAutoBackups' | 'restoreAutoBackup'>;

export interface LibraryFileServices {
  sync: LibraryFiles;
  backups: AutoBackups;
  appVersion: string;
}

const backupFile = (title: string): FileSuggestion => ({ title, filters: BACKUP_FILTERS });

/**
 * Project sharing (export/import), manual and automatic backups, and the app version.
 *
 * Each command that reads or writes a file takes its path as an argument and declares it, so the
 * shell asks for it: a native dialog in the app, a path argument in the CLI.
 *
 * Usage:
 *   registerBackupCommands(commands, { sync, backups, appVersion: runtime.version });
 */
export function registerBackupCommands(commands: CommandRegistry, services: LibraryFileServices): void {
  const { sync, backups, appVersion } = services;
  registerProjectFileCommands(commands, sync);
  registerFullBackupCommands(commands, sync);
  commands.add(IpcChannel.BACKUP_LIST_AUTO, () => backups.listAutoBackups());
  commands.add(IpcChannel.BACKUP_RESTORE_AUTO, (filename: string) => backups.restoreAutoBackup(filename));
  commands.add(IpcChannel.APP_GET_VERSION, () => appVersion);
}

function registerProjectFileCommands(commands: CommandRegistry, sync: LibraryFiles): void {
  const exported = (projectId: number): FileSuggestion => ({
    title: 'Exportar Projeto',
    defaultPath: `projeto_${projectId}.emmapcarc`,
    filters: PROJECT_FILTERS,
  });
  commands.add(
    IpcChannel.SYNC_EXPORT_PROJECT,
    (projectId: number, filePath: string) => sync.exportProject(projectId, filePath),
    { file: { at: 1, mode: 'save', kind: 'project', describe: exported } },
  );
  const imported = (): FileSuggestion => ({ title: 'Importar Projeto', filters: PROJECT_FILTERS });
  commands.add(IpcChannel.SYNC_IMPORT_PROJECT, (filePath: string) => sync.importProject(filePath), {
    file: { at: 0, mode: 'open', kind: 'project', describe: imported },
  });
}

function registerFullBackupCommands(commands: CommandRegistry, sync: LibraryFiles): void {
  const written = (): FileSuggestion => ({
    ...backupFile('Exportar Backup Completo'),
    defaultPath: `backup_${localIsoDate()}.emmabak`,
  });
  commands.add(IpcChannel.BACKUP_EXPORT, (filePath: string) => sync.exportBackup(filePath), {
    file: { at: 0, mode: 'save', kind: 'backup', describe: written },
  });
  const replacing = () => backupFile('Restaurar Backup Completo (Sobrescrever)');
  // false, not null, when no file is given: the renderer reads the answer as "was the library replaced?".
  commands.add(IpcChannel.BACKUP_RESTORE_OVERRIDE, (filePath: string) => sync.restoreBackupOverride(filePath), {
    file: { at: 0, mode: 'open', kind: 'backup', describe: replacing, whenNotChosen: false },
  });
  const merging = () => backupFile('Importar e Mesclar Backup');
  // null, not 0, when no file is given: the UI must not report "no new project" when nothing was tried.
  commands.add(IpcChannel.BACKUP_RESTORE_MERGE, (filePath: string) => sync.restoreBackupMerge(filePath), {
    file: { at: 0, mode: 'open', kind: 'backup', describe: merging },
  });
}

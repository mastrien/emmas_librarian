import { describe, it, expect, beforeEach } from 'vitest';
import { IpcChannel } from '../../../src/types';
import { CommandRegistry, type FileSuggestion } from '../CommandRegistry';
import { registerBackupCommands, type AutoBackups, type LibraryFiles } from '../backupCommands';

/** The file services: records each call as "method(args)" and answers like a successful run. */
class FakeLibraryFiles implements LibraryFiles {
  readonly calls: string[] = [];

  async exportProject(projectId: number, filePath: string): Promise<string> {
    this.calls.push(`exportProject(${projectId}, ${filePath})`);
    return filePath;
  }

  async importProject(importPath: string): Promise<number> {
    this.calls.push(`importProject(${importPath})`);
    return 12;
  }

  async exportBackup(filePath: string): Promise<string> {
    this.calls.push(`exportBackup(${filePath})`);
    return filePath;
  }

  async restoreBackupOverride(importPath: string): Promise<boolean> {
    this.calls.push(`restoreBackupOverride(${importPath})`);
    return true;
  }

  async restoreBackupMerge(importPath: string): Promise<number> {
    this.calls.push(`restoreBackupMerge(${importPath})`);
    return 3;
  }
}

class FakeAutoBackups implements AutoBackups {
  readonly restored: string[] = [];

  listAutoBackups() {
    return [{ filename: 'emma_backup_2026-11-14.db.gz', date: '2026-11-14', size: 10 }];
  }

  restoreAutoBackup(filename: string): boolean {
    this.restored.push(filename);
    return true;
  }
}

const PROJECT_FILTERS = [{ name: "Emma's Librarian Project", extensions: ['emmapcarc'] }];
const BACKUP_FILTERS = [{ name: "Emma's Librarian Backup", extensions: ['emmabak'] }];

describe('library file commands', () => {
  let commands: CommandRegistry;
  let sync: FakeLibraryFiles;
  let backups: FakeAutoBackups;

  const fileOf = (channel: IpcChannel) => commands.get(channel).file!;
  const described = (channel: IpcChannel, ...args: unknown[]) =>
    (fileOf(channel).describe as (...given: unknown[]) => FileSuggestion)(...args);

  beforeEach(() => {
    commands = new CommandRegistry();
    sync = new FakeLibraryFiles();
    backups = new FakeAutoBackups();
    registerBackupCommands(commands, { sync, backups, appVersion: '1.4.0' });
  });

  it('exports a project to the given file, which it describes by the project id', async () => {
    expect(await commands.run(IpcChannel.SYNC_EXPORT_PROJECT, 7, '/out/tese.emmapcarc')).toBe('/out/tese.emmapcarc');

    expect(sync.calls).toEqual(['exportProject(7, /out/tese.emmapcarc)']);
    expect(fileOf(IpcChannel.SYNC_EXPORT_PROJECT)).toMatchObject({ at: 1, mode: 'save', kind: 'project' });
    expect(described(IpcChannel.SYNC_EXPORT_PROJECT, 7)).toEqual({
      title: 'Exportar Projeto',
      defaultPath: 'projeto_7.emmapcarc',
      filters: PROJECT_FILTERS,
    });
  });

  it('imports a project from the given file', async () => {
    expect(await commands.run(IpcChannel.SYNC_IMPORT_PROJECT, '/in/tese.emmapcarc')).toBe(12);

    expect(sync.calls).toEqual(['importProject(/in/tese.emmapcarc)']);
    expect(fileOf(IpcChannel.SYNC_IMPORT_PROJECT)).toMatchObject({ at: 0, mode: 'open', kind: 'project' });
    expect(described(IpcChannel.SYNC_IMPORT_PROJECT)).toEqual({ title: 'Importar Projeto', filters: PROJECT_FILTERS });
  });

  it('writes a full backup to the given file, suggesting a name with the local date', async () => {
    expect(await commands.run(IpcChannel.BACKUP_EXPORT, '/out/tudo.emmabak')).toBe('/out/tudo.emmabak');

    expect(sync.calls).toEqual(['exportBackup(/out/tudo.emmabak)']);
    expect(fileOf(IpcChannel.BACKUP_EXPORT)).toMatchObject({ at: 0, mode: 'save', kind: 'backup' });
    const suggestion = described(IpcChannel.BACKUP_EXPORT);
    expect(suggestion.title).toBe('Exportar Backup Completo');
    expect(suggestion.defaultPath).toMatch(/^backup_\d{4}-\d{2}-\d{2}\.emmabak$/);
    expect(suggestion.filters).toEqual(BACKUP_FILTERS);
  });

  it('replaces the library from the given backup and answers false when no file is given', async () => {
    expect(await commands.run(IpcChannel.BACKUP_RESTORE_OVERRIDE, '/in/tudo.emmabak')).toBe(true);

    expect(sync.calls).toEqual(['restoreBackupOverride(/in/tudo.emmabak)']);
    expect(fileOf(IpcChannel.BACKUP_RESTORE_OVERRIDE)).toMatchObject({
      mode: 'open',
      kind: 'backup',
      whenNotChosen: false,
    });
    expect(described(IpcChannel.BACKUP_RESTORE_OVERRIDE).title).toBe('Restaurar Backup Completo (Sobrescrever)');
  });

  it('merges the given backup, answering how many projects came in, and null when no file is given', async () => {
    expect(await commands.run(IpcChannel.BACKUP_RESTORE_MERGE, '/in/tudo.emmabak')).toBe(3);

    expect(sync.calls).toEqual(['restoreBackupMerge(/in/tudo.emmabak)']);
    expect(fileOf(IpcChannel.BACKUP_RESTORE_MERGE).whenNotChosen).toBeUndefined();
    expect(described(IpcChannel.BACKUP_RESTORE_MERGE)).toEqual({
      title: 'Importar e Mesclar Backup',
      filters: BACKUP_FILTERS,
    });
  });

  it('lists and restores automatic backups by file name', async () => {
    expect(await commands.run(IpcChannel.BACKUP_LIST_AUTO)).toEqual(backups.listAutoBackups());
    expect(await commands.run(IpcChannel.BACKUP_RESTORE_AUTO, 'emma_backup_2026-11-14.db.gz')).toBe(true);

    expect(backups.restored).toEqual(['emma_backup_2026-11-14.db.gz']);
  });

  it('reports the app version it was given', async () => {
    expect(await commands.run(IpcChannel.APP_GET_VERSION)).toBe('1.4.0');
  });
});

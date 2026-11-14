import { describe, it, expect, beforeEach } from 'vitest';
import { IpcChannel } from '../../types';
import { registerBackupHandlers, type AutoBackups, type LibraryFiles } from '../handlers/backupHandlers';
import { FakeIpcMain } from './fakes/FakeIpcMain';
import { FakeFilePicker } from '../../ports/__tests__/fakes/FakeFilePicker';

/** The core's file services: records each call as "method(args)" and answers like a successful run. */
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
    return 0;
  }
}

class FakeAutoBackups implements AutoBackups {
  listAutoBackups() {
    return [];
  }

  restoreAutoBackup(): boolean {
    return true;
  }
}

describe('library file handlers', () => {
  let ipc: FakeIpcMain;
  let sync: FakeLibraryFiles;
  let picker: FakeFilePicker;

  beforeEach(() => {
    ipc = new FakeIpcMain();
    sync = new FakeLibraryFiles();
    picker = new FakeFilePicker();
    registerBackupHandlers(ipc, { sync, backups: new FakeAutoBackups(), picker, appVersion: '1.4.0' });
  });

  describe('SYNC_EXPORT_PROJECT', () => {
    it('asks where to save, suggesting a file named after the project id, and exports there', async () => {
      picker.savePath = '/home/ana/tese.emmapcarc';

      expect(await ipc.invoke(IpcChannel.SYNC_EXPORT_PROJECT, 7)).toBe('/home/ana/tese.emmapcarc');

      expect(picker.saveRequests).toEqual([
        {
          title: 'Exportar Projeto',
          defaultPath: 'projeto_7.emmapcarc',
          filters: [{ name: "Emma's Librarian Project", extensions: ['emmapcarc'] }],
        },
      ]);
      expect(sync.calls).toEqual(['exportProject(7, /home/ana/tese.emmapcarc)']);
    });

    it('answers null and exports nothing when the dialog is cancelled', async () => {
      expect(await ipc.invoke(IpcChannel.SYNC_EXPORT_PROJECT, 7)).toBeNull();
      expect(sync.calls).toEqual([]);
    });
  });

  describe('SYNC_IMPORT_PROJECT', () => {
    it('imports the file the renderer names without asking', async () => {
      expect(await ipc.invoke(IpcChannel.SYNC_IMPORT_PROJECT, '/dropped.emmapcarc')).toBe(12);

      expect(picker.openRequests).toEqual([]);
      expect(sync.calls).toEqual(['importProject(/dropped.emmapcarc)']);
    });

    it('asks for a project file when none is named; E2E runs answer with E2E_MOCK_PROJECT_FILE', async () => {
      picker.openPath = '/home/ana/tese.emmapcarc';

      expect(await ipc.invoke(IpcChannel.SYNC_IMPORT_PROJECT)).toBe(12);

      expect(picker.openRequests).toEqual([
        {
          title: 'Importar Projeto',
          filters: [{ name: "Emma's Librarian Project", extensions: ['emmapcarc'] }],
          answeredInE2EBy: 'E2E_MOCK_PROJECT_FILE',
        },
      ]);
      expect(sync.calls).toEqual(['importProject(/home/ana/tese.emmapcarc)']);
    });

    it('answers null and imports nothing when the dialog is cancelled', async () => {
      expect(await ipc.invoke(IpcChannel.SYNC_IMPORT_PROJECT)).toBeNull();
      expect(sync.calls).toEqual([]);
    });
  });

  describe('BACKUP_EXPORT', () => {
    it('suggests a file named after the local date and writes the backup where the user chose', async () => {
      picker.savePath = '/home/ana/tudo.emmabak';

      expect(await ipc.invoke(IpcChannel.BACKUP_EXPORT)).toBe('/home/ana/tudo.emmabak');

      expect(picker.saveRequests[0].title).toBe('Exportar Backup Completo');
      expect(picker.saveRequests[0].defaultPath).toMatch(/^backup_\d{4}-\d{2}-\d{2}\.emmabak$/);
      expect(sync.calls).toEqual(['exportBackup(/home/ana/tudo.emmabak)']);
    });

    it('answers null and writes nothing when the dialog is cancelled', async () => {
      expect(await ipc.invoke(IpcChannel.BACKUP_EXPORT)).toBeNull();
      expect(sync.calls).toEqual([]);
    });
  });

  describe('BACKUP_RESTORE_OVERRIDE', () => {
    it('restores the backup the user chose; E2E runs answer with E2E_MOCK_BACKUP_FILE', async () => {
      picker.openPath = '/home/ana/tudo.emmabak';

      expect(await ipc.invoke(IpcChannel.BACKUP_RESTORE_OVERRIDE)).toBe(true);

      expect(picker.openRequests[0]).toMatchObject({
        title: 'Restaurar Backup Completo (Sobrescrever)',
        answeredInE2EBy: 'E2E_MOCK_BACKUP_FILE',
      });
      expect(sync.calls).toEqual(['restoreBackupOverride(/home/ana/tudo.emmabak)']);
    });

    it('answers false and restores nothing when the dialog is cancelled', async () => {
      expect(await ipc.invoke(IpcChannel.BACKUP_RESTORE_OVERRIDE)).toBe(false);
      expect(sync.calls).toEqual([]);
    });
  });

  describe('BACKUP_RESTORE_MERGE', () => {
    it('merges the backup the user chose and answers how many projects came in', async () => {
      picker.openPath = '/home/ana/tudo.emmabak';

      expect(await ipc.invoke(IpcChannel.BACKUP_RESTORE_MERGE)).toBe(0);

      expect(picker.openRequests[0]).toMatchObject({
        title: 'Importar e Mesclar Backup',
        answeredInE2EBy: 'E2E_MOCK_BACKUP_FILE',
      });
      expect(sync.calls).toEqual(['restoreBackupMerge(/home/ana/tudo.emmabak)']);
    });

    it('answers null, not 0, when the dialog is cancelled', async () => {
      expect(await ipc.invoke(IpcChannel.BACKUP_RESTORE_MERGE)).toBeNull();
      expect(sync.calls).toEqual([]);
    });
  });

  it('reports the app version it was given', async () => {
    expect(await ipc.invoke(IpcChannel.APP_GET_VERSION)).toBe('1.4.0');
  });
});

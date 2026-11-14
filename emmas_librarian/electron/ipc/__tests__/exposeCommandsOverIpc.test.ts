import { describe, it, expect, beforeEach } from 'vitest';
import { IpcChannel } from '../../types';
import { CommandRegistry, type FileSuggestion } from '../../../core/commands/CommandRegistry';
import { exposeCommandsOverIpc } from '../exposeCommandsOverIpc';
import { FakeIpcMain } from './fakes/FakeIpcMain';
import { FakeFilePicker } from '../../ports/__tests__/fakes/FakeFilePicker';

const CSV = [{ name: 'CSV Files', extensions: ['csv'] }];
const csvNamed = (projectId: number): FileSuggestion => ({
  title: 'Exportar',
  defaultPath: `projeto_${projectId}.csv`,
  filters: CSV,
});
const anyFile = (title: string) => (): FileSuggestion => ({ title, filters: [] });

describe('exposeCommandsOverIpc', () => {
  let ipc: FakeIpcMain;
  let commands: CommandRegistry;
  let picker: FakeFilePicker;
  let ran: string[];

  const record =
    (name: string, answer: unknown) =>
    (...args: unknown[]) => {
      ran.push(`${name}(${args.join(', ')})`);
      return answer;
    };
  const expose = () => exposeCommandsOverIpc(ipc, commands, picker);

  beforeEach(() => {
    ipc = new FakeIpcMain();
    commands = new CommandRegistry();
    picker = new FakeFilePicker();
    ran = [];
  });

  it('registers one handler per command, on the channel of the same name', () => {
    commands.add('a:one', () => 1);
    commands.add('b:two', () => 2);

    expose();

    expect(ipc.channels()).toEqual(['a:one', 'b:two']);
  });

  it('runs a plain command with the renderer arguments, without the IPC event', async () => {
    commands.add('math:add', (a: number, b: number) => a + b);
    expose();

    expect(await ipc.invoke('math:add', 2, 3)).toBe(5);
  });

  it('reaches the renderer with a serialized AppError when the command fails', async () => {
    commands.add('fails', () => {
      throw new Error('UNIQUE constraint failed: projects.name');
    });
    expose();

    const failure = (await ipc.invoke('fails').catch((error: unknown) => error)) as Error;

    expect(JSON.parse(failure.message)).toMatchObject({ isAppError: true, code: 'ERR_DUPLICATE' });
  });

  describe('a command that writes a file', () => {
    beforeEach(() => {
      commands.add('export:csv', record('export', '/chosen.csv'), {
        file: { at: 1, mode: 'save', describe: csvNamed },
      });
      expose();
    });

    it('asks where to save, describing the file from the other arguments, and runs with the chosen path', async () => {
      picker.savePath = '/home/ana/saida.csv';

      expect(await ipc.invoke('export:csv', 7)).toBe('/chosen.csv');

      expect(picker.saveRequests).toEqual([{ title: 'Exportar', defaultPath: 'projeto_7.csv', filters: CSV }]);
      expect(ran).toEqual(['export(7, /home/ana/saida.csv)']);
    });

    it('answers null and runs nothing when the dialog is cancelled', async () => {
      expect(await ipc.invoke('export:csv', 7)).toBeNull();
      expect(ran).toEqual([]);
    });

    // The renderer must not decide where a file is written: only the person, in the dialog, does.
    it('ignores a path the renderer sends in the place of the file', async () => {
      picker.savePath = '/home/ana/saida.csv';

      await ipc.invoke('export:csv', 7, '/etc/passwd');

      expect(ran).toEqual(['export(7, /home/ana/saida.csv)']);
    });
  });

  it('fails before any dialog when the command rejects the arguments while describing the file', async () => {
    const refuse = (): FileSuggestion => {
      throw new Error('[ERR_NOT_FOUND] projectId=999');
    };
    commands.add('export:csv', record('export', null), { file: { at: 1, mode: 'save', describe: refuse } });
    expose();

    await expect(ipc.invoke('export:csv', 999)).rejects.toThrow('projectId=999');

    expect(picker.saveRequests).toEqual([]);
    expect(ran).toEqual([]);
  });

  describe('a command that reads a file', () => {
    it('asks for the file and runs with it', async () => {
      commands.add('set:read', record('read', ['a']), { file: { at: 0, mode: 'open', describe: anyFile('Abrir') } });
      expose();
      picker.openPath = '/home/ana/set.json';

      expect(await ipc.invoke('set:read')).toEqual(['a']);

      expect(picker.openRequests).toEqual([{ title: 'Abrir', filters: [], answeredInE2EBy: undefined }]);
      expect(ran).toEqual(['read(/home/ana/set.json)']);
    });

    it.each([
      ['project', 'E2E_MOCK_PROJECT_FILE'],
      ['backup', 'E2E_MOCK_BACKUP_FILE'],
    ] as const)('lets E2E runs answer a %s file with %s', async (kind, variable) => {
      commands.add('file:open', record('open', 1), { file: { at: 0, mode: 'open', kind, describe: anyFile('Abrir') } });
      expose();

      await ipc.invoke('file:open');

      expect(picker.openRequests[0].answeredInE2EBy).toBe(variable);
    });

    it('answers what the command declares for "no file chosen" when the dialog is cancelled', async () => {
      const describe = anyFile('Restaurar');
      commands.add('restore:all', record('restore', true), {
        file: { at: 0, mode: 'open', describe, whenNotChosen: false },
      });
      expose();

      expect(await ipc.invoke('restore:all')).toBe(false);
      expect(ran).toEqual([]);
    });

    it('never takes the file from the renderer for a restore: the person chooses it', async () => {
      commands.add(IpcChannel.BACKUP_RESTORE_OVERRIDE, record('restore', true), {
        file: { at: 0, mode: 'open', kind: 'backup', describe: anyFile('Restaurar'), whenNotChosen: false },
      });
      expose();

      expect(await ipc.invoke(IpcChannel.BACKUP_RESTORE_OVERRIDE, '/tmp/malicioso.emmabak')).toBe(false);
      expect(ran).toEqual([]);
    });
  });

  describe('project import', () => {
    beforeEach(() => {
      commands.add(IpcChannel.SYNC_IMPORT_PROJECT, record('import', 12), {
        file: { at: 0, mode: 'open', kind: 'project', describe: anyFile('Importar Projeto') },
      });
      expose();
    });

    it('imports the file the renderer names (a dropped file) without asking', async () => {
      expect(await ipc.invoke(IpcChannel.SYNC_IMPORT_PROJECT, '/dropped.emmapcarc')).toBe(12);

      expect(picker.openRequests).toEqual([]);
      expect(ran).toEqual(['import(/dropped.emmapcarc)']);
    });

    it('asks for the file when the renderer names none', async () => {
      picker.openPath = '/home/ana/tese.emmapcarc';

      await ipc.invoke(IpcChannel.SYNC_IMPORT_PROJECT);

      expect(ran).toEqual(['import(/home/ana/tese.emmapcarc)']);
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { IpcChannel } from '../../../src/types';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { AppError } from '../../errors/AppError';
import { CLI_EXIT, CLI_USAGE, cliFailureFrom, listCliCommands, runCli, type OpenedCliHost } from '../cliRunner';

const savedFile = { at: 1, mode: 'save' as const, describe: () => ({ title: 'Exportar', filters: [] }) };

/** A library with a few commands; counts how often it was opened and closed, and can pretend the app is running. */
class FakeCliLibrary implements OpenedCliHost {
  readonly commands = new CommandRegistry();
  appRunning = false;
  opened = 0;
  closed = 0;
  restored: string[] = [];

  constructor() {
    this.commands.add(IpcChannel.PROJECTS_GET_ALL, () => [{ id: 1, name: 'Tese' }]);
    this.commands.add(IpcChannel.PROJECTS_UPDATE, (id: number, name: string) => ({ id, name }));
    this.commands.add(IpcChannel.SETTINGS_SET, () => undefined);
    this.commands.add(IpcChannel.PDF_GET, () => Buffer.from('pdf'));
    this.commands.add(IpcChannel.EXPORT_CSV, (_id: number, filePath: string) => filePath, { file: savedFile });
    this.commands.add(IpcChannel.BACKUP_RESTORE_AUTO, (name: string) => this.restored.push(name) > 0);
  }

  isAppRunning = () => this.appRunning;
  close = () => {
    this.closed += 1;
  };
  open = () => {
    this.opened += 1;
    return this;
  };
}

describe('runCli', () => {
  let library: FakeCliLibrary;
  const run = (...argv: string[]) => runCli(argv, library.open);
  const failureOf = async (...argv: string[]) => {
    const outcome = await run(...argv);
    return { exitCode: outcome.exitCode, stdout: outcome.stdout, ...JSON.parse(outcome.stderr!).error };
  };

  beforeEach(() => {
    library = new FakeCliLibrary();
  });

  it('prints the result of a command as one JSON line on stdout and exits 0', async () => {
    expect(await run(IpcChannel.PROJECTS_UPDATE, '3', 'Tese final')).toEqual({
      exitCode: CLI_EXIT.ok,
      stdout: '{"ok":true,"result":{"id":3,"name":"Tese final"}}',
    });
  });

  it('prints null for a command that answers nothing', async () => {
    expect((await run(IpcChannel.SETTINGS_SET, 'theme', 'dark')).stdout).toBe('{"ok":true,"result":null}');
  });

  it('indents the JSON with --pretty', async () => {
    expect((await run(IpcChannel.PROJECTS_GET_ALL, '--pretty')).stdout).toBe(
      JSON.stringify({ ok: true, result: [{ id: 1, name: 'Tese' }] }, null, 2),
    );
  });

  it('closes the library after the command, also when it fails', async () => {
    await run(IpcChannel.PROJECTS_GET_ALL);
    await run('nope');

    expect([library.opened, library.closed]).toEqual([2, 2]);
  });

  it('prints the usage text without opening the library', async () => {
    expect(await run('--help')).toEqual({ exitCode: CLI_EXIT.ok, stdout: CLI_USAGE });
    expect(library.opened).toBe(0);
  });

  it('lists only what a terminal can run, with the file argument each command takes', async () => {
    const listed = JSON.parse((await run('commands')).stdout!).result;

    expect(listed).toEqual(listCliCommands(library.commands));
    expect(listed).toContainEqual({ name: IpcChannel.EXPORT_CSV, file: { argument: 2, mode: 'save' } });
    expect(listed).toContainEqual({ name: IpcChannel.PROJECTS_GET_ALL });
    expect(listed).not.toContainEqual({ name: IpcChannel.PDF_GET });
  });

  it('refuses an unknown command as a usage error on stderr, naming it', async () => {
    const failure = await failureOf('projects:getAl');

    expect(failure).toMatchObject({ exitCode: CLI_EXIT.usage, code: 'ERR_UNKNOWN_COMMAND', stdout: undefined });
    expect(failure.message).toContain('"projects:getAl"');
  });

  it('refuses a desktop-only command without running it', async () => {
    expect(await failureOf(IpcChannel.PDF_GET, '1')).toMatchObject({ exitCode: CLI_EXIT.usage, code: 'ERR_GUI_ONLY' });
  });

  it('asks for the file path a command needs, saying which argument it is', async () => {
    const failure = await failureOf(IpcChannel.EXPORT_CSV, '3');

    expect(failure).toMatchObject({ exitCode: CLI_EXIT.usage, code: 'ERR_MISSING_FILE_ARGUMENT' });
    expect(failure.message).toContain('argumento 2 de "export:csv"');
    expect((await run(IpcChannel.EXPORT_CSV, '3', './a.csv')).stdout).toBe('{"ok":true,"result":"./a.csv"}');
  });

  it('reports a bad option like any other failure', async () => {
    expect(await failureOf(IpcChannel.PROJECTS_GET_ALL, '--data-dir')).toMatchObject({
      exitCode: CLI_EXIT.usage,
      code: 'ERR_CLI_USAGE',
    });
  });

  it('refuses to replace the library while the desktop app has it open', async () => {
    library.appRunning = true;

    expect(await failureOf(IpcChannel.BACKUP_RESTORE_AUTO, 'emma_backup_2026-11-14.db.gz')).toMatchObject({
      exitCode: CLI_EXIT.libraryInUse,
      code: 'ERR_LIBRARY_IN_USE',
    });
    expect(library.restored).toEqual([]);
  });

  it('replaces the library when the app is closed, and runs other commands while it is open', async () => {
    expect((await run(IpcChannel.BACKUP_RESTORE_AUTO, 'emma_backup_2026-11-14.db.gz')).exitCode).toBe(CLI_EXIT.ok);
    library.appRunning = true;

    expect((await run(IpcChannel.PROJECTS_GET_ALL)).exitCode).toBe(CLI_EXIT.ok);
    expect(library.restored).toEqual(['emma_backup_2026-11-14.db.gz']);
  });

  it('reports a library that does not open', async () => {
    const outcome = await runCli([IpcChannel.PROJECTS_GET_ALL], () => {
      throw new AppError('ERR_LIBRARY_NOT_FOUND', 'USER_ERROR', 'Nenhuma biblioteca em /x');
    });

    expect(outcome.exitCode).toBe(CLI_EXIT.rejected);
    expect(JSON.parse(outcome.stderr!).error.code).toBe('ERR_LIBRARY_NOT_FOUND');
  });
});

describe('exit codes by kind of failure', () => {
  const exitFor = async (failure: unknown) => {
    const library = new FakeCliLibrary();
    library.commands.add('fails', () => {
      throw failure;
    });
    return (await runCli(['fails'], library.open)).exitCode;
  };

  it.each([
    [new AppError('ERR_DUPLICATE_NAME', 'USER_ERROR', 'x'), CLI_EXIT.rejected],
    [new AppError('ERR_INVALID', 'VALIDATION_ERROR', 'x'), CLI_EXIT.rejected],
    [new AppError('ERR_API', 'NETWORK_ERROR', 'x'), CLI_EXIT.network],
    [new Error('[ERR_NOT_FOUND] Projeto não encontrado. Offending value: projectId=9'), CLI_EXIT.rejected],
    [new Error('disco cheio'), CLI_EXIT.failed],
    [new Error('database is locked'), CLI_EXIT.failed],
  ])('%s exits %i', async (failure, exitCode) => {
    expect(await exitFor(failure)).toBe(exitCode);
  });
});

describe('cliFailureFrom', () => {
  it('keeps the code a plain error carries at the start of its message', () => {
    expect(cliFailureFrom(new Error('[ERR_NOT_FOUND] PDF não encontrado'))).toMatchObject({
      code: 'ERR_NOT_FOUND',
      type: 'USER_ERROR',
      message: '[ERR_NOT_FOUND] PDF não encontrado',
    });
  });

  it('leaves classified failures as they are', () => {
    expect(cliFailureFrom(new Error('UNIQUE constraint failed: projects.name')).code).toBe('ERR_DUPLICATE');
    expect(cliFailureFrom(new Error('sem código')).code).toBe('ERR_INTERNAL');
  });
});

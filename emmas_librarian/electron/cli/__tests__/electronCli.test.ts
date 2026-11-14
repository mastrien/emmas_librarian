import { describe, it, expect } from 'vitest';
import { CommandRegistry } from '../../../core/commands/CommandRegistry';
import type { OpenedCliHost } from '../../../core/cli/cliRunner';
import { cliArgumentsFrom, keepStdoutForResults, runElectronCli, streamSink, type CliProcess } from '../electronCli';

describe('cliArgumentsFrom', () => {
  it.each([
    [['/opt/app/emmas-librarian', 'cli', 'projects:getAll'], true, ['projects:getAll']],
    [['/opt/app/emmas-librarian', '--no-sandbox', 'cli', 'commands', '--pretty'], true, ['commands', '--pretty']],
    [['electron', 'dist-electron/electron/main.js', 'cli'], false, []],
    [['electron', 'main.js', '--ozone-platform=headless', 'cli', 'x', '1'], false, ['x', '1']],
  ])('reads %j as a CLI run', (argv, isPackaged, expected) => {
    expect(cliArgumentsFrom(argv, isPackaged)).toEqual(expected);
  });

  it.each([
    [['/opt/app/emmas-librarian'], true],
    [['/opt/app/emmas-librarian', '--remote-debugging-port=0'], true],
    [['/opt/app/emmas-librarian', '/home/ana/tese.emmapcarc', 'cli'], true],
    // Unpackaged, the script path itself may be called "cli": it is not an argument.
    [['electron', 'cli'], false],
    [['electron', 'main.js', '--remote-debugging-port=0'], false],
  ])('reads %j as a normal start of the app', (argv, isPackaged) => {
    expect(cliArgumentsFrom(argv, isPackaged)).toBeNull();
  });
});

describe('keepStdoutForResults', () => {
  it('sends console.log, info and debug to console.error', () => {
    const errors: unknown[][] = [];
    const target = {
      log: () => undefined,
      info: () => undefined,
      debug: () => undefined,
      error: (...args: unknown[]) => void errors.push(args),
    };

    keepStdoutForResults(target);
    target.log('a', 1);
    target.info('b');
    target.debug('c');

    expect(errors).toEqual([['a', 1], ['b'], ['c']]);
  });
});

/** The process around a CLI run: records what was printed, in order, and the exit code. */
class FakeCliProcess implements CliProcess {
  readonly events: string[] = [];
  readonly commands = new CommandRegistry();

  ready = async () => {
    this.events.push('ready');
  };
  open = (): OpenedCliHost => {
    this.events.push('open');
    return { commands: this.commands, isAppRunning: () => false, close: () => void this.events.push('close') };
  };
  stdout = async (text: string) => {
    this.events.push(`stdout:${text}`);
  };
  stderr = async (text: string) => {
    this.events.push(`stderr:${text}`);
  };
  exit = (code: number) => {
    this.events.push(`exit:${code}`);
  };
}

describe('runElectronCli', () => {
  it('waits for the shell, runs, prints the result with a newline and only then exits 0', async () => {
    const cli = new FakeCliProcess();
    cli.commands.add('math:add', (a: number, b: number) => a + b);

    await runElectronCli(['math:add', '2', '3'], cli);

    expect(cli.events).toEqual(['ready', 'open', 'close', 'stdout:{"ok":true,"result":5}\n', 'exit:0']);
  });

  it('prints a failure on stderr and exits with its code', async () => {
    const cli = new FakeCliProcess();

    await runElectronCli(['nope'], cli);

    expect(cli.events.slice(-2)).toEqual([
      expect.stringMatching(/^stderr:\{"ok":false,.*ERR_UNKNOWN_COMMAND.*\n$/),
      'exit:2',
    ]);
  });
});

describe('streamSink', () => {
  it('resolves once the stream took the text', async () => {
    const written: string[] = [];
    const stream = {
      write: (text: string, done: () => void) => {
        written.push(text);
        done();
        return true;
      },
    };

    await streamSink(stream as never)('linha\n');

    expect(written).toEqual(['linha\n']);
  });
});

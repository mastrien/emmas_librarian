import { describe, it, expect } from 'vitest';
import { AppError } from '../../errors/AppError';
import { CommandRegistry } from '../CommandRegistry';

describe('CommandRegistry', () => {
  it('runs a command by name with the arguments it was given', async () => {
    const commands = new CommandRegistry();
    commands.add('math:add', (a: number, b: number) => a + b);

    expect(await commands.run('math:add', 2, 3)).toBe(5);
  });

  it('awaits asynchronous commands and lets their failures through unchanged', async () => {
    const commands = new CommandRegistry();
    const failure = new Error('sem disco');
    commands.add('slow:ok', async () => 'pronto');
    commands.add('slow:fail', async () => {
      throw failure;
    });

    expect(await commands.run('slow:ok')).toBe('pronto');
    await expect(commands.run('slow:fail')).rejects.toBe(failure);
  });

  it('turns a synchronous throw into a rejection, so transports handle one kind of failure', async () => {
    const commands = new CommandRegistry();
    commands.add('sync:fail', () => {
      throw new Error('inválido');
    });

    await expect(commands.run('sync:fail')).rejects.toThrow('inválido');
  });

  it('refuses a second command under the same name, naming it', () => {
    const commands = new CommandRegistry();
    commands.add('projects:getAll', () => []);

    expect(() => commands.add('projects:getAll', () => [])).toThrow('"projects:getAll" is already registered');
  });

  it('rejects an unknown command with an AppError that names it', async () => {
    const commands = new CommandRegistry();
    commands.add('projects:getAll', () => []);

    const failure = await commands.run('projects:getAl').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AppError);
    expect(failure).toMatchObject({ code: 'ERR_UNKNOWN_COMMAND', type: 'VALIDATION_ERROR' });
    expect((failure as AppError).message).toContain('"projects:getAl"');
  });

  it('lists what is registered, with the file argument a command declares', () => {
    const commands = new CommandRegistry();
    const file = { at: 0, mode: 'open' as const, describe: () => ({ title: 'Abrir', filters: [] }) };
    commands.add('a', () => 1);
    commands.add('b', (path: string) => path, { file });

    expect(commands.names()).toEqual(['a', 'b']);
    expect(commands.has('b')).toBe(true);
    expect(commands.has('c')).toBe(false);
    expect(commands.list().map((command) => command.file)).toEqual([undefined, file]);
  });
});

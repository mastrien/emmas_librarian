import { describe, it, expect } from 'vitest';
import { CommandRegistry } from '../CommandRegistry';
import { requireTerminalCommand } from '../terminalCommands';

function registryWith(): CommandRegistry {
  const commands = new CommandRegistry();
  commands.add('app:getVersion', () => '1.4.0');
  commands.add('projects:create', (name: string) => name);
  commands.add('diary:save', (projectId: number, date: string, content: string) => [projectId, date, content]);
  commands.add('batch:run', (...ids: number[]) => ids);
  return commands;
}

function failureOf(call: () => unknown): { code?: string; message: string } {
  try {
    call();
  } catch (error) {
    return error as { code?: string; message: string };
  }
  throw new Error('expected the call to be refused');
}

describe('requireTerminalCommand: how many arguments', () => {
  // Regression: `cli app:getVersion 1 2 3` answered ok and ignored the 1 2 3; a name split at its spaces
  // (`projects:create Minha tese`) created a project called "Minha".
  it('refuses more arguments than the command has, naming them and the usage', () => {
    const failure = failureOf(() => requireTerminalCommand(registryWith(), 'projects:create', ['Minha', 'tese']));

    expect(failure.code).toBe('ERR_CLI_USAGE');
    expect(failure.message).toContain('Argumentos demais para "projects:create"');
    expect(failure.message).toContain('2 argumentos ["Minha","tese"]');
    expect(failure.message).toContain('emmas-librarian cli projects:create -- <name>');
  });

  it('refuses any argument to a command that takes none', () => {
    expect(failureOf(() => requireTerminalCommand(registryWith(), 'app:getVersion', [1, 2, 3])).code).toBe(
      'ERR_CLI_USAGE',
    );
  });

  it.each([
    ['app:getVersion', []],
    ['projects:create', ['Minha tese']],
    ['diary:save', [3, '2026-11-14', 'texto']],
    // The last ones may be optional: TypeScript's `?` does not exist at run time, so fewer is never refused.
    ['diary:save', [3]],
    ['batch:run', [1, 2, 3, 4, 5]],
  ])('lets %s run with %j', (name, args) => {
    expect(requireTerminalCommand(registryWith(), name, args).name).toBe(name);
  });
});

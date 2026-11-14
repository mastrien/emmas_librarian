import { IpcChannel } from '../../src/types';
import { usageError } from '../errors/usageError';
import type { CommandRegistry, RegisteredCommand } from './CommandRegistry';
import { surfaceOf } from './channelSurfaces';

const isChannel = (name: string): name is IpcChannel => (Object.values(IpcChannel) as string[]).includes(name);
const worksInTerminal = (name: string) => !isChannel(name) || surfaceOf(name) === 'cli';

/** A command as `commands` lists it: its name and, if it takes a file, which argument that is. */
export interface TerminalCommandInfo {
  name: string;
  file?: { argument: number; mode: 'open' | 'save' };
}

/**
 * Every command a terminal can run, with the file argument it takes, if any.
 *
 * Usage:
 *   listTerminalCommands(commands); // [{ name: 'projects:getAll' }, { name: 'export:csv', file: { argument: 2, mode: 'save' } }]
 */
export function listTerminalCommands(commands: CommandRegistry): TerminalCommandInfo[] {
  return commands
    .list()
    .filter((command) => worksInTerminal(command.name))
    .map(({ name, file }) => (file ? { name, file: { argument: file.at + 1, mode: file.mode } } : { name }));
}

function requireFileArgument(command: RegisteredCommand, args: unknown[]): void {
  const { file } = command;
  if (!file || (typeof args[file.at] === 'string' && args[file.at] !== '')) return;
  const purpose = file.mode === 'save' ? 'a gravar' : 'a ler';
  throw usageError(
    'ERR_MISSING_FILE_ARGUMENT',
    `Falta o caminho do arquivo ${purpose}. Offending value: argumento ${file.at + 1} = ${JSON.stringify(args[file.at])}`,
    `o caminho do arquivo como argumento ${file.at + 1} de "${command.name}"`,
  );
}

/**
 * The command a terminal asked for, checked: it exists, it is not desktop-only, and the file it reads
 * or writes was given as a path. Each refusal is a usage error naming the value.
 *
 * Usage:
 *   const command = requireTerminalCommand(commands, 'export:csv', [3, './a.csv']);
 */
export function requireTerminalCommand(commands: CommandRegistry, name: string, args: unknown[]): RegisteredCommand {
  if (!worksInTerminal(name)) {
    throw usageError(
      'ERR_GUI_ONLY',
      `Comando disponível só no aplicativo. Offending value: "${name}"`,
      'um comando listado por `commands`',
    );
  }
  const command = commands.get(name);
  requireFileArgument(command, args);
  return command;
}

import { IpcChannel } from '../../src/types';
import { usageError } from '../errors/usageError';
import type { CommandRegistry, RegisteredCommand } from './CommandRegistry';
import { surfaceOf } from './channelSurfaces';

const isChannel = (name: string): name is IpcChannel => (Object.values(IpcChannel) as string[]).includes(name);
const worksInTerminal = (name: string) => !isChannel(name) || surfaceOf(name) === 'cli';

/** A command as `commands` lists it: its name and, if it takes a file, which argument that is. */
export interface TerminalCommandInfo {
  name: string;
  /** The names of the command's arguments, in order. */
  args: string[];
  file?: { argument: number; mode: 'open' | 'save' };
}

/**
 * Every command a terminal can run, with the file argument it takes, if any.
 *
 * Usage:
 *   listTerminalCommands(commands);
 *   // [{ name: 'projects:getOne', args: ['projectId'] },
 *   //  { name: 'export:csv', args: ['projectId', 'filePath'], file: { argument: 2, mode: 'save' } }]
 */
export function listTerminalCommands(commands: CommandRegistry): TerminalCommandInfo[] {
  return commands
    .list()
    .filter((command) => worksInTerminal(command.name))
    .map(({ name, parameters: args, file }) =>
      file ? { name, args, file: { argument: file.at + 1, mode: file.mode } } : { name, args },
    );
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

// A command that took `app:getVersion 1 2 3` ran and answered ok: the extra arguments were dropped without
// a word, and so was the half of a name that a shell had split at its spaces (`projects:create Minha tese`).
function requireNoExtraArguments(command: RegisteredCommand, args: unknown[]): void {
  const { name, parameters } = command;
  const takesAny = parameters.some((parameter) => parameter.startsWith('...'));
  if (takesAny || args.length <= parameters.length) return;
  throw usageError(
    'ERR_CLI_USAGE',
    `Argumentos demais para "${name}". Offending value: ${args.length} argumentos ${JSON.stringify(args)}`,
    `no máximo ${parameters.length}: ${terminalUsage(command)}; um texto com espaços vai entre aspas`,
  );
}

/**
 * The command a terminal asked for, checked: it exists, it is not desktop-only, it was not given more
 * arguments than it has, and the file it reads or writes was given as a path. Each refusal is a usage
 * error naming the value.
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
  requireNoExtraArguments(command, args);
  requireFileArgument(command, args);
  return command;
}

/**
 * The usage line of one command, for `cli <command> --help`. Which trailing arguments are optional is
 * not known here: TypeScript's `?` does not exist at run time.
 *
 * The `--` is not decoration: Electron's CheckCommandLineArguments (the CVE-2018-1000006 fix) exits -1, before
 * any of our code runs, when a URL-looking word like `diary:save` is followed by another loose word; only
 * `--` switches that check off, so the arguments come after it.
 *
 * Usage:
 *   terminalUsage(commands.get('diary:save')); // 'emmas-librarian cli diary:save -- <projectId> <date> <content> <expected>'
 */
export function terminalUsage(command: RegisteredCommand): string {
  const args = command.parameters.map((name) => `<${name}>`);
  return ['emmas-librarian cli', command.name, ...(args.length > 0 ? ['--', ...args] : [])].join(' ');
}

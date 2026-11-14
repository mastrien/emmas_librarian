import { IpcChannel } from '../../src/types';
import type { CommandRegistry, RegisteredCommand } from '../commands/CommandRegistry';
import { surfaceOf } from '../commands/channelSurfaces';
import { AppError, type ErrorType } from '../errors/AppError';
import { shellFailureFrom } from '../errors/shellFailureFrom';
import { libraryInUse, replacesLibrary } from '../commands/libraryReplacement';
import { parseCliArguments, usageError, type CliOptions, type CliRequest } from './cliArguments';

/** Exit codes of the CLI; scripts and tool-calling agents branch on these. */
export const CLI_EXIT = {
  ok: 0,
  /** The command ran and failed for a reason of the system (disk, database, a bug). */
  failed: 1,
  /** The CLI was called wrongly: unknown or desktop-only command, bad option, missing file argument. */
  usage: 2,
  /** The command refused its input: something not found, a duplicate name, an invalid value. */
  rejected: 3,
  /** A network or provider failure: the same call may work later. */
  network: 4,
  /** The desktop app has the library open and this command would replace it. */
  libraryInUse: 5,
} as const;

export interface CliOutcome {
  exitCode: number;
  /** One JSON document: `{ ok: true, result }` on stdout, or `{ ok: false, error }` on stderr. */
  stdout?: string;
  stderr?: string;
}

export interface CliHost {
  commands: CommandRegistry;
  /** Whether the desktop app is running on the same library. */
  isAppRunning: () => boolean;
}

const USAGE_CODES = new Set(['ERR_CLI_USAGE', 'ERR_UNKNOWN_COMMAND', 'ERR_GUI_ONLY', 'ERR_MISSING_FILE_ARGUMENT']);
const EXIT_BY_TYPE: Record<ErrorType, number> = {
  SYSTEM_ERROR: CLI_EXIT.failed,
  USER_ERROR: CLI_EXIT.rejected,
  VALIDATION_ERROR: CLI_EXIT.rejected,
  NETWORK_ERROR: CLI_EXIT.network,
};

const isChannel = (name: string): name is IpcChannel => (Object.values(IpcChannel) as string[]).includes(name);

function exitCodeOf(error: AppError): number {
  if (error.code === 'ERR_LIBRARY_IN_USE') return CLI_EXIT.libraryInUse;
  if (USAGE_CODES.has(error.code)) return CLI_EXIT.usage;
  return EXIT_BY_TYPE[error.type] ?? CLI_EXIT.failed;
}

function failure(error: unknown, pretty: boolean): CliOutcome {
  const reported = shellFailureFrom(error);
  const { code, type, message } = reported;
  const document = { ok: false, error: { code, type, message } };
  return { exitCode: exitCodeOf(reported), stderr: JSON.stringify(document, null, pretty ? 2 : 0) };
}

function success(result: unknown, pretty: boolean): CliOutcome {
  return { exitCode: CLI_EXIT.ok, stdout: JSON.stringify({ ok: true, result: result ?? null }, null, pretty ? 2 : 0) };
}

function requireCliCommand(commands: CommandRegistry, name: string): RegisteredCommand {
  if (isChannel(name) && surfaceOf(name) === 'gui-only') {
    throw usageError(
      'ERR_GUI_ONLY',
      `Comando disponível só no aplicativo. Offending value: "${name}"`,
      'um comando listado por `commands`',
    );
  }
  return commands.get(name);
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

function refuseWhileAppRuns(name: string, host: CliHost): void {
  if (replacesLibrary(name) && host.isAppRunning()) throw libraryInUse(name);
}

/** What `commands` prints: every command a terminal can run, with the file argument it takes, if any. */
export function listCliCommands(commands: CommandRegistry) {
  return commands
    .list()
    .filter((command) => !isChannel(command.name) || surfaceOf(command.name) === 'cli')
    .map(({ name, file }) => (file ? { name, file: { argument: file.at + 1, mode: file.mode } } : { name }));
}

export const CLI_USAGE = [
  "Emma's Librarian CLI",
  '',
  'Uso: emmas-librarian cli <comando> [argumentos...] [opções]',
  '',
  '  commands                 lista os comandos disponíveis',
  '  <comando> [args...]      roda um comando; cada argumento é lido como JSON quando possível, senão como texto',
  '',
  'Opções:',
  '  --args-json <array>      os argumentos do comando como um array JSON (em vez dos posicionais)',
  '  --data-dir <pasta>       abre a biblioteca desta pasta em vez da do aplicativo',
  '  --pretty                 JSON indentado',
  '  --help                   esta ajuda',
  '',
  'Saída: um documento JSON. Sucesso em stdout: {"ok":true,"result":...}. Falha em stderr: {"ok":false,"error":{...}}.',
  'Códigos de saída: 0 ok, 1 falha do sistema, 2 uso incorreto, 3 entrada recusada, 4 rede, 5 biblioteca em uso.',
  '',
  'Exemplos:',
  '  emmas-librarian cli projects:getAll --pretty',
  '  emmas-librarian cli projects:create "Minha tese"',
  '  emmas-librarian cli export:csv 3 ./artigos.csv',
].join('\n');

/**
 * Runs one CLI request against the library's commands and answers what to print and the exit code.
 * It never throws: every failure becomes a JSON error and a code.
 *
 * Usage:
 *   const outcome = await runCliRequest(parseCliArguments(argv), { commands, isAppRunning });
 *   process.exitCode = outcome.exitCode;
 */
export async function runCliRequest(request: CliRequest, host: CliHost): Promise<CliOutcome> {
  const { pretty } = request.options;
  if (request.kind === 'help') return { exitCode: CLI_EXIT.ok, stdout: CLI_USAGE };
  if (request.kind === 'list') return success(listCliCommands(host.commands), pretty);
  try {
    const command = requireCliCommand(host.commands, request.command);
    requireFileArgument(command, request.args);
    refuseWhileAppRuns(command.name, host);
    return success(await host.commands.run(command.name, ...request.args), pretty);
  } catch (error) {
    return failure(error, pretty);
  }
}

/** A library opened for one CLI run; `close` releases the database file. */
export interface OpenedCliHost extends CliHost {
  close: () => void;
}

/**
 * The whole CLI: parses the arguments, opens the library only when a command needs it, runs, and
 * closes it. A bad option or a library that does not open is reported like any other failure.
 *
 * Usage:
 *   const outcome = await runCli(['projects:getAll'], (options) => openLibraryFor(options));
 */
export async function runCli(argv: string[], open: (options: CliOptions) => OpenedCliHost): Promise<CliOutcome> {
  try {
    const request = parseCliArguments(argv);
    if (request.kind === 'help') return { exitCode: CLI_EXIT.ok, stdout: CLI_USAGE };
    const host = open(request.options);
    try {
      return await runCliRequest(request, host);
    } finally {
      host.close();
    }
  } catch (error) {
    return failure(error, argv.includes('--pretty'));
  }
}

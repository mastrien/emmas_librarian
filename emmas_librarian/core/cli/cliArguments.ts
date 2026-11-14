import { AppError } from '../errors/AppError';

export interface CliOptions {
  /** Library folder to open instead of the app's own. */
  dataDir?: string;
  /** Indent the JSON for a person; the default is one line, for scripts. */
  pretty: boolean;
}

export type CliRequest =
  | { kind: 'help'; options: CliOptions }
  | { kind: 'list'; options: CliOptions }
  | { kind: 'run'; command: string; args: unknown[]; options: CliOptions };

/**
 * A mistake in how the CLI was called (not a failure of a command): exit code 2.
 *
 * Usage:
 *   throw usageError('ERR_CLI_USAGE', `--data-dir sem valor`, 'um caminho de pasta depois de --data-dir');
 */
export function usageError(code: string, problem: string, expected: string): AppError {
  return new AppError(code, 'VALIDATION_ERROR', `[${code}] ${problem}. Expected shape: ${expected}.`);
}

// A value is JSON when it parses (3, true, null, [1,2], {"a":1}, "text"); anything else is taken as text,
// so `emma projects:create Tese` needs no quoting. Text that looks like JSON is passed as '"123"'.
function valueOf(token: string): unknown {
  try {
    return JSON.parse(token);
  } catch {
    return token;
  }
}

function argsFromJson(text: string | undefined): unknown[] {
  const parsed: unknown = text === undefined ? undefined : valueOf(text);
  if (Array.isArray(parsed)) return parsed;
  throw usageError(
    'ERR_CLI_USAGE',
    `--args-json inválido. Offending value: ${JSON.stringify(text)}`,
    `um array JSON com os argumentos do comando, por exemplo --args-json '[3, "nota"]'`,
  );
}

function requireValue(flag: string, value: string | undefined): string {
  if (value !== undefined && !value.startsWith('--')) return value;
  throw usageError('ERR_CLI_USAGE', `${flag} sem valor. Offending value: ${JSON.stringify(value)}`, `${flag} <valor>`);
}

interface ParsedTokens {
  options: CliOptions;
  positional: string[];
  help: boolean;
  argsJson?: unknown[];
}

function readTokens(argv: string[]): ParsedTokens {
  const parsed: ParsedTokens = { options: { pretty: false }, positional: [], help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--pretty') parsed.options.pretty = true;
    else if (token === '--help' || token === '-h') parsed.help = true;
    else if (token === '--data-dir') parsed.options.dataDir = requireValue(token, argv[(i += 1)]);
    else if (token === '--args-json') parsed.argsJson = argsFromJson(argv[(i += 1)]);
    else parsed.positional.push(token);
  }
  return parsed;
}

/**
 * Reads what comes after `cli` on the command line: `<command> [arguments...]` plus options.
 * `commands` lists what can be run; no command, `help` or `--help` asks for the usage text.
 *
 * Usage:
 *   parseCliArguments(['projects:create', 'Tese', '--pretty']);
 *   // { kind: 'run', command: 'projects:create', args: ['Tese'], options: { pretty: true } }
 */
export function parseCliArguments(argv: string[]): CliRequest {
  const { options, positional, help, argsJson } = readTokens(argv);
  const [command, ...rest] = positional;
  if (help || command === undefined || command === 'help') return { kind: 'help', options };
  if (command === 'commands') return { kind: 'list', options };
  if (argsJson && rest.length > 0) {
    throw usageError(
      'ERR_CLI_USAGE',
      `Argumentos dados duas vezes. Offending value: ${JSON.stringify(rest)} junto com --args-json`,
      'argumentos posicionais ou --args-json, não os dois',
    );
  }
  return { kind: 'run', command, args: argsJson ?? rest.map(valueOf), options };
}

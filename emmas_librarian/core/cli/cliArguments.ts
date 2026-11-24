import { usageError } from '../errors/usageError';

export interface CliOptions {
  /** Library folder to open instead of the app's own. */
  dataDir?: string;
  /** Indent the JSON for a person; the default is one line, for scripts. */
  pretty: boolean;
}

export type CliRequest =
  | { kind: 'help'; command?: string; options: CliOptions }
  | { kind: 'list'; options: CliOptions }
  | { kind: 'run'; command: string; args: unknown[]; options: CliOptions };

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

const VALUE_OPTIONS = new Set(['--data-dir', '--args-json']);

// `--data-dir=/lib` is read as `--data-dir /lib`. Only the options that take a value are split, so an
// argument such as `a=b` stays whole.
function splitInlineValue(token: string): string[] {
  const equals = token.indexOf('=');
  if (equals < 0 || !VALUE_OPTIONS.has(token.slice(0, equals))) return [token];
  return [token.slice(0, equals), token.slice(equals + 1)];
}

function withInlineValuesSplit(argv: string[]): string[] {
  const end = argv.indexOf('--');
  const options = end < 0 ? argv : argv.slice(0, end);
  return [...options.flatMap(splitInlineValue), ...(end < 0 ? [] : argv.slice(end))];
}

// A typo such as `--data-dir=` or `--prety` used to become an argument and run the command anyway,
// possibly on the wrong library; now it stops the run.
function unknownOption(token: string): never {
  throw usageError(
    'ERR_CLI_USAGE',
    `Opção desconhecida. Offending value: ${JSON.stringify(token)}`,
    'uma de --pretty, --help, --data-dir <pasta>, --args-json <array>; para passar como argumento um valor que começa com --, ponha -- antes dos argumentos',
  );
}

function readTokens(argv: string[]): ParsedTokens {
  const tokens = withInlineValuesSplit(argv);
  const parsed: ParsedTokens = { options: { pretty: false }, positional: [], help: false };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '--') {
      parsed.positional.push(...tokens.slice(i + 1));
      break;
    }
    if (token === '--pretty') parsed.options.pretty = true;
    else if (token === '--help' || token === '-h') parsed.help = true;
    else if (token === '--data-dir') parsed.options.dataDir = requireValue(token, tokens[(i += 1)]);
    else if (token === '--args-json') parsed.argsJson = argsFromJson(tokens[(i += 1)]);
    else if (token.startsWith('--')) unknownOption(token);
    else parsed.positional.push(token);
  }
  return parsed;
}

/**
 * Reads what comes after `cli` on the command line: `<command> [arguments...]` plus options.
 * `commands` lists what can be run; no command, `help` or `--help` asks for the usage text, and
 * `<command> --help` for the usage of that command.
 *
 * Usage:
 *   parseCliArguments(['projects:create', 'Tese', '--pretty']);
 *   // { kind: 'run', command: 'projects:create', args: ['Tese'], options: { pretty: true } }
 */
export function parseCliArguments(argv: string[]): CliRequest {
  const { options, positional, help, argsJson } = readTokens(argv);
  const [command, ...rest] = positional;
  if (command === undefined || command === 'help') return { kind: 'help', options };
  // `<command> --help` asks how that command is called.
  if (help) return { kind: 'help', command: command === 'commands' ? undefined : command, options };
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

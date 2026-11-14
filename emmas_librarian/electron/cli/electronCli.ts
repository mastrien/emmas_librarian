import type { CliOptions } from '../../core/cli/cliArguments';
import { runCli, type CliOutcome, type OpenedCliHost } from '../../core/cli/cliRunner';

/**
 * The arguments of a CLI run, or null when the app was started normally. `cli` must be the first
 * word that is not a Chromium switch: `emmas-librarian cli projects:getAll`,
 * `electron main.js --no-sandbox cli commands`.
 *
 * Usage:
 *   const cliArgs = cliArgumentsFrom(process.argv, app.isPackaged);
 *   if (cliArgs) startCli(cliArgs); else startDesktopApp();
 */
export function cliArgumentsFrom(argv: string[], isPackaged: boolean): string[] | null {
  // Unpackaged, argv[1] is the main script (or the app folder) handed to the Electron binary.
  const own = argv.slice(isPackaged ? 1 : 2);
  const first = own.findIndex((token) => !token.startsWith('-'));
  return first >= 0 && own[first] === 'cli' ? own.slice(first + 1) : null;
}

/** Console methods that write to stdout, where only the result may go. */
const STDOUT_METHODS = ['log', 'info', 'debug'] as const;

/**
 * Sends everything the code prints with console.log to stderr, so stdout carries only the JSON result.
 *
 * Usage:
 *   keepStdoutForResults(console);
 */
export function keepStdoutForResults(target: Pick<Console, 'log' | 'info' | 'debug' | 'error'>): void {
  for (const method of STDOUT_METHODS) {
    target[method] = (...args: unknown[]) => target.error(...args);
  }
}

/** A text sink that reports when the text has left the process (a pipe may still be draining). */
export type TextSink = (text: string) => Promise<void>;

export interface CliProcess {
  /** Resolves once the shell can open the library (Electron: app ready, so safeStorage works). */
  ready: () => Promise<unknown>;
  open: (options: CliOptions) => OpenedCliHost;
  stdout: TextSink;
  stderr: TextSink;
  exit: (code: number) => void;
}

async function print(outcome: CliOutcome, cli: CliProcess): Promise<void> {
  if (outcome.stdout !== undefined) await cli.stdout(`${outcome.stdout}\n`);
  if (outcome.stderr !== undefined) await cli.stderr(`${outcome.stderr}\n`);
}

/**
 * Runs the CLI inside the app's own process and ends it with the command's exit code. The output is
 * flushed first: exiting right after a write truncates what a pipe has not read yet.
 *
 * Usage:
 *   await runElectronCli(cliArgs, { ready: () => app.whenReady(), open, stdout, stderr, exit: (c) => app.exit(c) });
 */
export async function runElectronCli(args: string[], cli: CliProcess): Promise<void> {
  await cli.ready();
  const outcome = await runCli(args, cli.open);
  await print(outcome, cli);
  cli.exit(outcome.exitCode);
}

/**
 * A sink over a Node stream that resolves when the chunk was handed to the operating system.
 *
 * Usage:
 *   const stdout = streamSink(process.stdout);
 */
export function streamSink(stream: Pick<NodeJS.WriteStream, 'write'>): TextSink {
  return (text) => new Promise((resolve) => stream.write(text, () => resolve()));
}

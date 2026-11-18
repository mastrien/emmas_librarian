import { execFile } from 'node:child_process';
import path from 'node:path';
import type { AskDeps } from '../../../core/agent/ask';
import { startAgentRuntime } from '../../../core/agent/runtime/agentRuntime';
import { consentOnTerminal } from '../../../core/agent/runtime/downloadConsent';
import { listLlamaDevices, type RunProgram } from '../../../core/agent/runtime/listDevices';
import type { CliOptions } from '../../../core/cli/cliArguments';
import { ReadlinePrompter } from '../../../core/cli/readlinePrompter';
import { TerminalConfirmer } from '../../../core/cli/terminalConfirmer';
import { usageError } from '../../../core/errors/usageError';

export interface AskEnvironment {
  /** The app's data folder: the models go in a `models` folder inside it unless --models-dir says otherwise. */
  userData: string;
  env: Record<string, string | undefined>;
  stdin: NodeJS.ReadableStream;
  /** Questions go to stderr, so stdout keeps only the answer. */
  stderr: NodeJS.WritableStream;
}

const runProgram: RunProgram = (file, args) =>
  new Promise((resolve, reject) =>
    execFile(file, args, { windowsHide: true }, (error, stdout, stderr) =>
      error && !stdout && !stderr ? reject(error) : resolve(`${stdout}\n${stderr}`),
    ),
  );

function requireServer(options: CliOptions, env: AskEnvironment['env']): string {
  const server = options.llamaServer ?? env.LLAMA_SERVER;
  if (server) return server;
  throw usageError(
    'ERR_LLAMA_SERVER_NOT_FOUND',
    'Falta o llama-server. Offending value: nenhum --llama-server e nenhuma variável LLAMA_SERVER',
    'o caminho do llama-server b12425, em --llama-server <caminho> ou na variável LLAMA_SERVER',
  );
}

/**
 * What `cli ask` needs in the app's process: the models in the data folder (downloaded after a yes), llama-server from
 * the option or the environment, and the terminal for every question to the person.
 *
 * Usage:
 *   const deps = askDepsFor(options, { userData, env: process.env, stdin: process.stdin, stderr: process.stderr });
 */
export function askDepsFor(options: CliOptions, environment: AskEnvironment): AskDeps {
  const prompter = new ReadlinePrompter(environment.stdin, environment.stderr);
  return {
    confirmer: new TerminalConfirmer(prompter),
    now: () => new Date(),
    startRuntime: () => {
      const server = requireServer(options, environment.env);
      return startAgentRuntime({
        server,
        modelsDir: options.modelsDir ?? path.join(environment.userData, 'models'),
        listDevices: () => listLlamaDevices(server, runProgram),
        fetch: (url, init) => fetch(url, init),
        consent: consentOnTerminal(prompter),
        onProgress: undefined,
      });
    },
  };
}

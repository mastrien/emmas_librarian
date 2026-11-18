import { usageError } from '../../errors/usageError';

/** Runs a program and gives what it printed on either output; a failure to start it throws. */
export type RunProgram = (file: string, args: string[]) => Promise<string>;

/**
 * What `llama-server --list-devices` prints. A server that cannot start is a usage problem, said with its path.
 *
 * Usage:
 *   const listing = await listLlamaDevices('/opt/llama/llama-server', run);
 */
export async function listLlamaDevices(server: string, run: RunProgram): Promise<string> {
  try {
    return await run(server, ['--list-devices']);
  } catch (error) {
    throw usageError(
      'ERR_LLAMA_SERVER_NOT_FOUND',
      `Não consegui rodar o llama-server. Offending value: ${JSON.stringify(server)} (${String(error)})`,
      'o caminho do llama-server b12425, em --llama-server ou na variável LLAMA_SERVER',
    );
  }
}

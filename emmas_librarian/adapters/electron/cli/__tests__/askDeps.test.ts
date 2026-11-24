// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { CliOptions } from '../../../../core/cli/cliArguments';
import { DialogPrompter } from '../dialogPrompter';
import { askDepsFor, runProgram, runtimeDepsFor, type AskEnvironment } from '../askDeps';

const showMessageBox: AskEnvironment['showMessageBox'] = async () => ({ response: 1 });
const environment = (env: AskEnvironment['env'] = {}): AskEnvironment => ({
  userData: 'C:/dados',
  env,
  showMessageBox,
});
const options = (over: Partial<CliOptions> = {}): CliOptions => ({ ...({} as CliOptions), ...over });

describe('askDepsFor', () => {
  it('gives a confirmer, a clock and a way to start the runtime', () => {
    const deps = askDepsFor(options(), environment());
    expect(typeof deps.confirmer.confirm).toBe('function');
    expect(deps.now()).toBeInstanceOf(Date);
    expect(typeof deps.startRuntime).toBe('function');
  });

  it('refuses to start without llama-server, saying neither the option nor LLAMA_SERVER was given', () => {
    const deps = askDepsFor(options(), environment());
    expect(() => deps.startRuntime()).toThrow(/ERR_LLAMA_SERVER_NOT_FOUND|llama-server/);
  });

  it('does not take the server from the environment when the option is given, and the other way round', async () => {
    const withOption = askDepsFor(options({ llamaServer: 'F:/bin/llama-server.exe' }), environment());
    const withEnv = askDepsFor(options(), environment({ LLAMA_SERVER: 'F:/bin/llama-server.exe' }));
    // Both get past the check; the runtime itself then fails on a server that does not exist, which is not under test.
    await expect(Promise.resolve().then(() => withOption.startRuntime())).rejects.not.toThrow(/Falta o llama-server/);
    await expect(Promise.resolve().then(() => withEnv.startRuntime())).rejects.not.toThrow(/Falta o llama-server/);
  });
});

describe('runProgram', () => {
  it('gives back what the program wrote on stdout and on stderr', async () => {
    const script = "process.stdout.write('saida'); process.stderr.write('erro')";
    const text = await runProgram(process.execPath, ['-e', script]);
    expect(text).toContain('saida');
    expect(text).toContain('erro');
  });

  it('fails when the program does not exist, since there is nothing it wrote to read', async () => {
    await expect(runProgram('C:/nao/existe/llama-server.exe', [])).rejects.toThrow(/ENOENT/);
  });
});

describe('runtimeDepsFor', () => {
  const prompter = new DialogPrompter(showMessageBox);

  it('puts the models in a models folder of the data folder unless --models-dir says otherwise', () => {
    const env = { LLAMA_SERVER: 'F:/bin/llama-server.exe' };
    const inData = runtimeDepsFor(options(), environment(env), prompter);
    expect(inData.modelsDir.replaceAll(String.fromCharCode(92), '/')).toBe('C:/dados/models');
    expect(runtimeDepsFor(options({ modelsDir: 'D:/modelos' }), environment(env), prompter).modelsDir).toBe(
      'D:/modelos',
    );
  });

  it('lists the devices with the llama-server it was given', async () => {
    const deps = runtimeDepsFor(options({ llamaServer: process.execPath }), environment(), prompter);
    // node does not know --list-devices, but whatever it writes is what the device list is read from.
    await expect(deps.listDevices()).resolves.toEqual(expect.any(String));
  });

  it('fetches with the global fetch, so a download goes through the network of the app', async () => {
    const deps = runtimeDepsFor(options({ llamaServer: 'x' }), environment(), prompter);
    await expect(deps.fetch('http://127.0.0.1:1/modelo.gguf')).rejects.toThrow();
  });
});

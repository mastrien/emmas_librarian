// @vitest-environment node
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runAppUntilExit } from '../helpers';
import { FakeExecFile } from './fakes/FakeExecFile';

// The helper refuses to run on Linux CI without a display. These tests start no Electron, so take the run out of
// CI mode in every test (a module-level stub is undone by unstubAllEnvs after the first one: the Ubuntu job of
// PR #25 failed that way while Windows passed).
beforeEach(() => {
  vi.stubEnv('CI', '');
  vi.stubEnv('HEADLESS_E2E', '');
});
afterEach(() => vi.unstubAllEnvs());

const run = (launcher, env = {}, options = {}) =>
  runAppUntilExit(env, { userDataDir: '/tmp/emma-data', execFileImpl: launcher.execFile, ...options });

describe('runAppUntilExit', () => {
  it('starts the app on the given library, marked as an automated launch', async () => {
    const launcher = new FakeExecFile();
    await run(launcher, { E2E_MOCK_RECOVERY_CHOICE: '0' });
    const [{ args, options }] = launcher.calls;
    expect(args).toContain('--remote-debugging-port=0');
    expect(args[0]).toBe(path.resolve(__dirname, '../../dist-electron/electron/main.js'));
    expect(options.env).toMatchObject({
      E2E_USER_DATA_DIR: '/tmp/emma-data',
      E2E_SKIP_RELAUNCH: 'true',
      E2E_MOCK_RECOVERY_CHOICE: '0',
    });
  });

  it('gives the app 60 s by default and the timeout it is given otherwise', async () => {
    const launcher = new FakeExecFile();
    await run(launcher);
    await run(launcher, {}, { timeoutMs: 5000 });
    expect(launcher.calls.map((call) => call.options.timeout)).toEqual([60000, 5000]);
  });

  it('returns everything the app printed when it exits cleanly', async () => {
    const launcher = new FakeExecFile({ stdout: '[E2E recovery dialog] box', stderr: 'warn' });
    expect(await run(launcher)).toEqual({ code: 0, signal: null, stdout: '[E2E recovery dialog] box', stderr: 'warn' });
  });

  it('keeps the output and the exit status of an app that fails', async () => {
    const launcher = new FakeExecFile({ error: Object.assign(new Error('exit 3'), { code: 3 }), stdout: 'partial' });
    expect(await run(launcher)).toMatchObject({ code: 3, signal: null, stdout: 'partial' });
  });

  it('reports the signal when the timeout killed the app, so a hang is not read as a clean exit', async () => {
    const killed = Object.assign(new Error('timed out'), { killed: true, signal: 'SIGTERM', code: null });
    const result = await run(new FakeExecFile({ error: killed }));
    expect(result.signal).toBe('SIGTERM');
  });

  it('reports ENOENT when Electron could not be started', async () => {
    const launcher = new FakeExecFile({ error: Object.assign(new Error('spawn'), { code: 'ENOENT' }) });
    expect((await run(launcher)).code).toBe('ENOENT');
  });

  it('refuses to start without a display, before launching anything', () => {
    vi.stubEnv('HEADLESS_E2E', 'true');
    const launcher = new FakeExecFile();
    expect(() => run(launcher)).toThrow(/Erro de Ambiente/);
    expect(launcher.calls).toEqual([]);
  });
});

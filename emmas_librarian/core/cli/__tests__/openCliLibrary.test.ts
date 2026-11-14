// A real library in a temp folder, opened the way the CLI opens it.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { IpcChannel } from '../../../src/types';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { appPathsIn, type AppPaths } from '../../ports/AppPaths';
import { FakeSecretStore } from '../../ports/__tests__/fakes/FakeSecretStore';
import { markAppRunning } from '../appRunningMarker';
import { CLI_EXIT, runCli } from '../cliRunner';
import { cliHostFor, openCliLibrary } from '../openCliLibrary';

let workDir: string;
let paths: AppPaths;

const open =
  (alive = () => true) =>
  () =>
    openCliLibrary({ paths, secrets: new FakeSecretStore(), appVersion: '1.4.0', env: {}, alive });
const createLibrary = () => {
  fs.mkdirSync(paths.userData, { recursive: true });
  new DatabaseAdapter(paths.dbPath).close();
};

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-cli-'));
  paths = appPathsIn(path.join(workDir, 'userData'));
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('openCliLibrary', () => {
  it('refuses a folder without a library instead of creating an empty one', async () => {
    const outcome = await runCli([IpcChannel.PROJECTS_GET_ALL], open());

    expect(outcome.exitCode).toBe(CLI_EXIT.rejected);
    expect(JSON.parse(outcome.stderr!).error).toMatchObject({ code: 'ERR_LIBRARY_NOT_FOUND' });
    expect(outcome.stderr).toContain(JSON.stringify(paths.dbPath).slice(1, -1));
    expect(fs.existsSync(paths.dbPath)).toBe(false);
  });

  it('runs commands on the library, and what one run writes the next one reads', async () => {
    createLibrary();

    await runCli([IpcChannel.PROJECTS_CREATE, 'Tese'], open());
    const listed = await runCli([IpcChannel.PROJECTS_GET_ALL], open());

    expect(JSON.parse(listed.stdout!).result).toMatchObject([{ name: 'Tese' }]);
  });

  it('writes a file where the argument says', async () => {
    createLibrary();
    const target = path.join(workDir, 'artigos.csv');
    await runCli([IpcChannel.PROJECTS_CREATE, 'Tese'], open());

    const outcome = await runCli([IpcChannel.EXPORT_CSV, '1', target], open());

    expect(JSON.parse(outcome.stdout!)).toEqual({ ok: true, result: target });
    expect(fs.readFileSync(target, 'utf8')).toContain('title');
  });

  it('stores API keys through the secret store it was given, and reports the version it was given', async () => {
    createLibrary();

    await runCli([IpcChannel.SETTINGS_SET, 'api_key_openai', 'sk-1'], open());

    const raw = new DatabaseAdapter(paths.dbPath);
    const stored = raw.getDB().prepare("SELECT value FROM settings WHERE key = 'api_key_openai'").get();
    raw.close();
    expect(stored).toEqual({ value: Buffer.from('encrypted_sk-1').toString('base64') });
    expect((await runCli([IpcChannel.APP_GET_VERSION], open())).stdout).toBe('{"ok":true,"result":"1.4.0"}');
  });

  it('sees the desktop app running on the same library through its marker', async () => {
    createLibrary();
    markAppRunning(paths.userData, 4242);

    const whileOpen = await runCli([IpcChannel.BACKUP_RESTORE_AUTO, 'emma_backup_2026-11-14.db.gz'], open());
    const afterCrash = await runCli(
      [IpcChannel.BACKUP_RESTORE_AUTO, 'emma_backup_2026-11-14.db.gz'],
      open(() => false),
    );

    expect(whileOpen.exitCode).toBe(CLI_EXIT.libraryInUse);
    // Past the guard, the command itself fails: there is no such backup file.
    expect(afterCrash.exitCode).not.toBe(CLI_EXIT.libraryInUse);
  });
});

describe('cliHostFor', () => {
  const host = (alive: () => boolean) => ({
    paths,
    secrets: new FakeSecretStore(),
    appVersion: '1.4.0',
    env: {},
    alive,
  });

  it('opens the library itself when no app is running on it', async () => {
    createLibrary();

    const outcome = await runCli([IpcChannel.PROJECTS_CREATE, 'Tese'], () =>
      cliHostFor(
        host(() => false),
        workDir,
      ),
    );

    expect(outcome.exitCode).toBe(CLI_EXIT.ok);
  });

  // A marker left by a crash, whose process id now belongs to something else: nobody answers on that port.
  it('falls back to opening the library when the marked app does not answer', async () => {
    createLibrary();
    markAppRunning(paths.userData, 4242, { port: 1, token: 'velho' });

    const outcome = await runCli([IpcChannel.PROJECTS_GET_ALL], () =>
      cliHostFor(
        host(() => true),
        workDir,
      ),
    );

    expect(JSON.parse(outcome.stdout!)).toEqual({ ok: true, result: [] });
  });
});

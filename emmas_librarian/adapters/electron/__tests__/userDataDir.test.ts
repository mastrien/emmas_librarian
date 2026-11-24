import { describe, it, expect } from 'vitest';
import os from 'os';
import path from 'path';
import { isE2ELaunch, resolveUserDataDir, type UserDataContext } from '../userDataDir';

const dev: UserDataContext = {
  isPackaged: false,
  isProductionEnv: false,
  argv: ['electron', 'main.js'],
  env: {},
  cwd: '/repo',
  pid: 42,
};
const playwright = { ...dev, argv: ['electron', '--remote-debugging-port=0', 'main.js'] };

describe('resolveUserDataDir', () => {
  it('uses ./dev_data in development', () => {
    expect(resolveUserDataDir(dev)).toBe(path.join('/repo', 'dev_data'));
  });

  it('keeps the default (installed library) for packaged or production builds', () => {
    expect(resolveUserDataDir({ ...dev, isPackaged: true })).toBeNull();
    expect(resolveUserDataDir({ ...dev, isProductionEnv: true })).toBeNull();
  });

  it('gives an automated launch a throwaway temp folder instead of the default', () => {
    expect(resolveUserDataDir(playwright)).toBe(path.join(os.tmpdir(), 'emmas-librarian-e2e-42'));
  });

  it('prefers an explicit E2E_USER_DATA_DIR, even for packaged builds', () => {
    const env = { E2E_USER_DATA_DIR: '/tmp/run-1' };

    expect(resolveUserDataDir({ ...playwright, env })).toBe('/tmp/run-1');
    expect(resolveUserDataDir({ ...dev, isPackaged: true, env })).toBe('/tmp/run-1');
  });
});

describe('isE2ELaunch', () => {
  it.each([
    [['electron', '--remote-debugging-port=0'], true],
    [['electron', '--user-data-dir=/x'], true],
    [['electron', 'main.js'], false],
  ])('%j -> %s', (argv, expected) => {
    expect(isE2ELaunch(argv)).toBe(expected);
  });
});

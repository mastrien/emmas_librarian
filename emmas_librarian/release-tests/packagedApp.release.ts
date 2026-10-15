import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getFirstWindow } from '../e2e-tests/helpers';
import { appVersion, PACKAGE_VERSION } from './installedApp';
import { unpackedExecutable } from './packagedApp';

/**
 * The packaged app, straight out of electron-builder and before anything is published, opens its library.
 *
 * Why it exists: v1.2.0 and v1.2.1 shipped a better-sqlite3 built for Node (ABI 127) in an Electron 41 app
 * (ABI 145). The build job had run `npm test`, which rebuilds the module for Node, and the rebuild back for
 * Electron was skipped. The app showed "Startup Error" on every machine, and the upgrade tests missed it because
 * they build their installer in another order than release.yml. The window only opens after the library does,
 * so a module that cannot load never gets this far.
 */
test('the packaged app opens its library and reports the version being released', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-packaged-'));
  const executablePath = unpackedExecutable(process.platform, path.join(__dirname, '..', 'release'));
  const app = await electron.launch({
    executablePath,
    env: { ...process.env, E2E_USER_DATA_DIR: userData, E2E_SKIP_RELAUNCH: 'true' },
  });
  try {
    await getFirstWindow(app);
    expect(await appVersion(app)).toBe(PACKAGE_VERSION);
    expect(fs.existsSync(path.join(userData, 'emma.db'))).toBe(true);
  } finally {
    await app.close().catch(() => undefined);
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

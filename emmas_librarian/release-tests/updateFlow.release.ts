import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { gunzipSync } from 'zlib';
import { findLostData, type LibraryDump } from './libraryDump';
import { serveUpdates } from './updateServer';
import {
  API_KEY,
  PREFERENCES,
  USER_DATA,
  appIsRunning,
  closeRunningApp,
  dumpInstalledLibrary,
  expectLibraryOnScreen,
  fillInstalledLibrary,
  install,
  keepAppLogs,
  launchInstalled,
  readPreferencesAndKey,
  refuseToTouchARealLibrary,
  setPreferencesAndKey,
  waitUntil,
} from './installedApp';

/**
 * A release as a person gets it: version FROM, installed and full of data, finds TO on the update server,
 * downloads it when asked, snapshots the library, installs silently and reopens; the new version passes
 * its first-boot check and keeps everything. Both builds come from this checkout
 * (release-tests/build-update-pair.mjs), so this exercises the updater that ships next, not the old one.
 */
const FROM = process.env.RELEASE_TEST_UPDATE_FROM ?? '9.0.0';
const TO = process.env.RELEASE_TEST_UPDATE_TO ?? '9.0.1';
const FROM_INSTALLER = process.env.RELEASE_TEST_UPDATE_FROM_INSTALLER ?? '';
const UPDATE_FOLDER = process.env.RELEASE_TEST_UPDATE_FOLDER ?? '';
const UPDATE_PORT = Number(process.env.RELEASE_TEST_UPDATE_PORT ?? 8765);

test.afterEach(keepAppLogs);

/** Banner → "Atualizar" (download) → Settings → "Reiniciar e Instalar Atualização"; the app then quits. */
async function updateThroughTheApp(page: Page, appClosed: Promise<unknown>): Promise<void> {
  await expect(page.getByText(`v${TO}`)).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: 'Atualizar' }).click();
  const installButton = page.getByRole('button', { name: 'Reiniciar e Instalar Atualização' });
  await expect(installButton).toBeVisible({ timeout: 180000 });
  const clicked = Date.now();
  await installButton.click();
  await appClosed;
  // How long the app took to quit for the installer: a slow quit keeps files locked while it installs.
  const quitMs = Date.now() - clicked;
  test.info().annotations.push({ type: 'quit-for-installer-ms', description: String(quitMs) });
  console.log(`[release-test] ${FROM} quit for the installer ${quitMs} ms after "Reiniciar e Instalar"`);
}

function readUpdateState(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(USER_DATA, 'update_state.json'), 'utf-8'));
}

/** The pre-update snapshot (a gzipped emma.db), dumped like the live library. */
function dumpSnapshot(snapshotPath: string): LibraryDump {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'emma-snapshot-')), 'emma.db');
  fs.writeFileSync(file, gunzipSync(fs.readFileSync(snapshotPath)));
  return dumpInstalledLibrary('pre-update-snapshot', file);
}

test('a release through the app’s own updater keeps the whole library', async () => {
  test.setTimeout(20 * 60 * 1000);
  refuseToTouchARealLibrary();
  const server = await serveUpdates(UPDATE_FOLDER, UPDATE_PORT);
  try {
    await test.step(`install ${FROM}, fill its library, set preferences and a key`, async () => {
      install(FROM_INSTALLER);
      await (await launchInstalled()).app.close();
      fillInstalledLibrary();
      const { app, page } = await launchInstalled();
      await setPreferencesAndKey(page);
      await expectLibraryOnScreen(page);
      await app.close();
    });

    const before = dumpInstalledLibrary('before-update');

    await test.step(`${FROM} finds ${TO}, downloads it when asked and installs it`, async () => {
      const { app, page } = await launchInstalled();
      await updateThroughTheApp(page, app.waitForEvent('close', { timeout: 120000 }));
      await waitUntil(() => !appIsRunning(), 60000, `${FROM} to quit for the installer`);
    });

    // The installer reopens the app only once it has finished (--force-run), so that is the signal; the
    // exe's file version is no use here, it does not follow the version injected into these builds.
    await test.step('the installer reopens the app, which passes its first-boot check', async () => {
      await waitUntil(appIsRunning, 5 * 60 * 1000, 'the installer to finish and reopen the app (--force-run)');
      await waitUntil(() => readUpdateState().status === 'verified', 60000, 'update_state.json to say "verified"');
      await closeRunningApp();
    });

    const state = readUpdateState();
    expect(state).toMatchObject({ status: 'verified', fromVersion: FROM, targetVersion: TO });
    expect(findLostData(before, dumpSnapshot(String(state.snapshotPath)))).toEqual([]);

    await test.step(`${TO} shows the library, the preferences and the API key`, async () => {
      const { app, page } = await launchInstalled();
      const version = await page.evaluate(() => window.electronAPI.invoke('app:getVersion'));
      const { prefs, key } = await readPreferencesAndKey(page);
      await expectLibraryOnScreen(page);
      await app.close();

      expect(version).toBe(TO);
      expect(prefs).toEqual(PREFERENCES);
      expect(key).toBe(API_KEY);
    });

    expect(findLostData(before, dumpInstalledLibrary('after-update'))).toEqual([]);
    expect(server.requests).toEqual(expect.arrayContaining(['latest.yml']));
    expect(server.requests.some((name) => name.endsWith(`${TO}.exe`))).toBe(true);
  } finally {
    await server.close();
  }
});

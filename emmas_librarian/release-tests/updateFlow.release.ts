import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { gunzipSync } from 'zlib';
import { findLostData, type LibraryDump } from './libraryDump';
import { serveUpdates } from './updateServer';
import { waitUntil } from './waitUntil';
import {
  API_KEY,
  PLATFORM,
  PREFERENCES,
  USER_DATA,
  appIsRunning,
  appVersion,
  checkKeyStorage,
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
} from './installedApp';

/**
 * A release as a person gets it: version FROM, installed and full of data, finds TO on the update server,
 * downloads it when asked, snapshots the library, installs silently and reopens; the new version passes
 * its first-boot check and keeps everything. Both builds come from this checkout
 * (release-tests/build-update-pair.mjs), so this exercises the updater that ships next, not the old one.
 *
 * What it does not prove: both builds share this checkout's schema, so no migration runs and "nothing was
 * lost" holds by construction here; migrations are upgrade.release.ts's job. The update comes from a local
 * "generic" server without blockmaps (always a full download) instead of GitHub Releases (differential
 * download, release notes, GitHub's release lookup).
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
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-snapshot-'));
  try {
    const file = path.join(folder, 'emma.db');
    fs.writeFileSync(file, gunzipSync(fs.readFileSync(snapshotPath)));
    return dumpInstalledLibrary('pre-update-snapshot', file);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

test('a release through the app’s own updater keeps the whole library', async () => {
  test.setTimeout(20 * 60 * 1000);
  refuseToTouchARealLibrary();
  const server = await serveUpdates(UPDATE_FOLDER, UPDATE_PORT);
  try {
    await test.step(`install ${FROM}, fill its library, set preferences and a key`, async () => {
      // The first install on a fresh runner sometimes crashes (0xC0000005) whatever the installer (issue #22);
      // this one is setup, not what the test is about, so it may be started again.
      install(FROM_INSTALLER, { tolerateCrash: true });
      await (await launchInstalled()).app.close();
      fillInstalledLibrary();
      const { app, page } = await launchInstalled();
      await setPreferencesAndKey(page);
      await checkKeyStorage(app);
      await expectLibraryOnScreen(page);
      await app.close();
    });

    const before = dumpInstalledLibrary('before-update');

    await test.step(`${FROM} finds ${TO}, downloads it when asked and installs it`, async () => {
      const { app, page } = await launchInstalled();
      await updateThroughTheApp(page, app.waitForEvent('close', { timeout: 120000 }));
    });

    // The installer reopens the app once it has finished (--force-run), and that first boot of TO marks the
    // update "verified": the one signal that does not depend on how long FROM took to quit (up to ~60 s in
    // 2 of 3 runs, by which time TO may already be open). The exe's file version does not follow the
    // version injected into these builds, so it cannot tell either.
    await test.step('the installer reopens the app, which passes its first-boot check', async () => {
      await waitUntil(
        () => readUpdateState().status === 'verified',
        5 * 60 * 1000,
        `${TO}'s first boot to mark "verified"`,
      );
      expect(appIsRunning()).toBe(true);
      await closeRunningApp();
    });

    const state = readUpdateState();
    expect(state).toMatchObject({ status: 'verified', fromVersion: FROM, targetVersion: TO });
    expect(findLostData(before, dumpSnapshot(String(state.snapshotPath)))).toEqual([]);

    await test.step(`${TO} shows the library, the preferences and the API key`, async () => {
      const { app, page } = await launchInstalled();
      const version = await appVersion(app);
      const { prefs, key } = await readPreferencesAndKey(page);
      await expectLibraryOnScreen(page);
      await app.close();

      expect(version).toBe(TO);
      expect(prefs).toEqual(PREFERENCES);
      expect(key).toBe(API_KEY);
    });

    expect(findLostData(before, dumpInstalledLibrary('after-update'))).toEqual([]);
    expect(server.requests).toEqual(expect.arrayContaining([PLATFORM.updateMetadataFile]));
    // "Emma's Librarian Setup 9.0.1.exe" on Windows, "emmas-librarian-9.0.1-x86_64.AppImage" on Linux.
    const downloaded = (name: string) => name.includes(TO) && name.endsWith(PLATFORM.installerExtension);
    expect(server.requests.some(downloaded)).toBe(true);
  } finally {
    await server.close();
  }
});

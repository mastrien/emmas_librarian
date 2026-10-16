import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getFirstWindow, navigateTo } from '../e2e-tests/helpers';
import { buildFullLibrary, copyLibraryInto, openLibrary } from './libraryTransfer';
import { dumpLibrary, type LibraryDump } from './libraryDump';
import { installedAppPlatform } from './installedPlatform';
import type { InstallOptions } from './platformTypes';
import { waitUntil } from './waitUntil';

/**
 * The installed app, as the release tests drive it: installed by the platform's own means (NSIS on Windows, an
 * AppImage on Linux), launched through Playwright, and the library under its real data folder (installed apps
 * have no switch for another one).
 */
export const INSTALL_DIR = process.env.RELEASE_TEST_INSTALL_DIR ?? path.join(os.tmpdir(), 'emma-release-test', 'app');
export const PLATFORM = installedAppPlatform(process.platform, process.env, INSTALL_DIR);
// Electron's userData for the installed app: %APPDATA%/<package name> on Windows, ~/.config/<package name> on Linux.
export const USER_DATA = PLATFORM.userData;
export const API_KEY = 'sk-release-test-0123456789';
export const PREFERENCES = { theme: 'dark', accent: 'green', emma_sidebar_width: '320' };

// GitHub Actions sets GITHUB_ACTIONS on its runners only; CI=true is also set by many local tools, and this
// test installs over the app and force-closes every "Emma's Librarian" process.
export function refuseToTouchARealLibrary(): void {
  if (process.env.GITHUB_ACTIONS === 'true' || process.env.RELEASE_TEST_ALLOW_REAL_LIBRARY === '1') return;
  throw new Error(
    `[ERR_RELEASE_TEST_REAL_LIBRARY] Refusing to run: it installs over "${INSTALL_DIR}", rewrites "${USER_DATA}" (the ` +
      "library of any Emma's Librarian installed here) and closes every running Emma's Librarian. Expected " +
      'GITHUB_ACTIONS=true (GitHub runner) or RELEASE_TEST_ALLOW_REAL_LIBRARY=1 on a throwaway machine.',
  );
}

export type { InstallOptions };

/** Installs `installer` into INSTALL_DIR the way this platform does. */
export const install = (installer: string, options?: InstallOptions): void => PLATFORM.install(installer, options);

/** Version of this checkout (package.json): what the build under test reports. */
export const PACKAGE_VERSION = (
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')) as { version: string }
).version;

/** The version the running app reports (app.getVersion() in its main process). */
export const appVersion = (app: ElectronApplication): Promise<string> =>
  app.evaluate(({ app: electronApp }) => electronApp.getVersion());

export async function launchInstalled(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({ executablePath: PLATFORM.appExecutable });
  return { app, page: await getFirstWindow(app) };
}

export async function expectLibraryOnScreen(page: Page): Promise<void> {
  await navigateTo(page, 'Projetos');
  await expect(page.getByText('Tese', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Revisão', { exact: true })).toBeVisible();
  await expect(page.getByText('Projeto antigo', { exact: true })).toHaveCount(0);
}

/** Copies the full test library into the installed app's library, as far as its schema goes. */
export function fillInstalledLibrary(): void {
  const target = openLibrary(path.join(USER_DATA, 'emma.db'));
  const source = buildFullLibrary(USER_DATA);
  try {
    const report = copyLibraryInto(source, target);
    fs.writeFileSync(test.info().outputPath('transfer-report.json'), JSON.stringify(report, null, 2));
  } finally {
    source.close();
    target.close();
  }
}

/** Sets the interface preferences and an API key through the app, so safeStorage encrypts it for real. */
export async function setPreferencesAndKey(page: Page): Promise<void> {
  await page.evaluate((prefs) => Object.entries(prefs).forEach(([k, v]) => localStorage.setItem(k, v)), PREFERENCES);
  await page.evaluate((key) => window.electronAPI.invoke('settings:set', 'api_key_openai', key), API_KEY);
}

/**
 * Records which safeStorage backend holds the API key and, when RELEASE_TEST_EXPECT_KEY_STORAGE is set, checks it:
 * on Linux a run meant to use the keyring (gnome_libsecret) would otherwise pass on plain basic_text unnoticed.
 * Windows always uses DPAPI ("os" here).
 */
export async function checkKeyStorage(app: ElectronApplication): Promise<void> {
  const backend = await app.evaluate(({ safeStorage }) =>
    process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : 'os',
  );
  test.info().annotations.push({ type: 'key-storage', description: backend });
  console.log(`[release-test] API key storage: ${backend}`);
  const expected = process.env.RELEASE_TEST_EXPECT_KEY_STORAGE;
  if (expected) expect(backend, 'safeStorage backend (RELEASE_TEST_EXPECT_KEY_STORAGE)').toBe(expected);
}

export async function readPreferencesAndKey(
  page: Page,
): Promise<{ prefs: Record<string, string | null>; key: unknown }> {
  const prefs = await page.evaluate(
    (keys) => Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])),
    Object.keys(PREFERENCES),
  );
  const key = await page.evaluate(() => window.electronAPI.invoke('settings:get', 'api_key_openai'));
  return { prefs, key };
}

/** Dumps a library file (the installed one by default) and keeps the dump with the test's results. */
export function dumpInstalledLibrary(name: string, dbPath = path.join(USER_DATA, 'emma.db')): LibraryDump {
  const db = openLibrary(dbPath);
  try {
    const dump = dumpLibrary(db, USER_DATA);
    fs.writeFileSync(test.info().outputPath(`${name}.json`), JSON.stringify(dump, null, 2));
    return dump;
  } finally {
    db.close();
  }
}

/**
 * Keeps the app's main.log with the results: on GitHub runners it lives on another drive than the
 * checkout, and the artifact upload cannot take both.
 */
export function keepAppLogs(): void {
  const logs = path.join(USER_DATA, 'logs');
  if (fs.existsSync(logs)) fs.cpSync(logs, test.info().outputPath('app-logs'), { recursive: true });
}

/** Whether an app process is running that Playwright did not start (e.g. reopened by the installer). */
export const appIsRunning = (): boolean => PLATFORM.appIsRunning();

/** Closes the app's windows as clicking X would, and ends whatever is left after 10 s. */
export async function closeRunningApp(): Promise<void> {
  PLATFORM.askAppToClose();
  await waitUntil(() => !appIsRunning(), 10000, 'the app to close').catch(() => undefined);
  if (appIsRunning()) PLATFORM.forceQuitApp();
}

import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getFirstWindow, navigateTo } from '../e2e-tests/helpers';
import { buildFullLibrary, copyLibraryInto, openLibrary } from './libraryTransfer';
import { dumpLibrary, findLostData, type LibraryDump } from './libraryDump';

/**
 * Installs the published release, fills it with the full test library, installs the new build over it
 * the way the auto-updater does, and checks that nothing was lost. Runs before a release, on a clean
 * GitHub runner (.github/workflows/release-upgrade-test.yml): installed apps have no switch for another
 * data folder, so this uses the app's real one.
 */
const OLD_INSTALLER = process.env.RELEASE_TEST_OLD_INSTALLER ?? '';
const NEW_INSTALLER = process.env.RELEASE_TEST_NEW_INSTALLER ?? '';
const INSTALL_DIR = process.env.RELEASE_TEST_INSTALL_DIR ?? path.join(os.tmpdir(), 'emma-release-test', 'app');
const API_KEY = 'sk-release-test-0123456789';
const PREFERENCES = { theme: 'dark', accent: 'green', emma_sidebar_width: '320' };

// Electron's userData for the installed app: %APPDATA%/<package name> on Windows (Linux: issue #17).
const USER_DATA = path.join(process.env.APPDATA ?? '', 'emmas_librarian');

function refuseToTouchARealLibrary(): void {
  if (process.env.CI === 'true' || process.env.RELEASE_TEST_ALLOW_REAL_LIBRARY === '1') return;
  throw new Error(
    `[ERR_RELEASE_TEST_REAL_LIBRARY] Refusing to run: it installs over "${INSTALL_DIR}" and rewrites "${USER_DATA}", ` +
      "the library of any Emma's Librarian installed here. Expected CI=true (GitHub runner) or RELEASE_TEST_ALLOW_REAL_LIBRARY=1 on a throwaway machine.",
  );
}

/** Silent NSIS install into INSTALL_DIR; extra args (e.g. --updated) are the ones electron-updater passes. */
function install(installer: string, ...args: string[]): void {
  if (!fs.existsSync(installer)) {
    throw new Error(`[ERR_RELEASE_TEST_INSTALLER] Installer not found: "${installer}". Expected a NSIS setup .exe.`);
  }
  // NSIS requires /D= last and unquoted.
  const result = spawnSync(installer, [...args, '/S', `/D=${INSTALL_DIR}`], { encoding: 'utf-8', timeout: 300000 });
  if (result.status === 0) return;
  throw new Error(
    `[ERR_RELEASE_TEST_INSTALL] "${path.basename(installer)} ${args.join(' ')}" exited with status=${result.status} ` +
      `signal=${result.signal} error=${result.error?.message}; app exe present=${fs.existsSync(appExe())}; ` +
      `stdout=${JSON.stringify(result.stdout)} stderr=${JSON.stringify(result.stderr)}. Expected status 0.`,
  );
}

const appExe = () => path.join(INSTALL_DIR, "Emma's Librarian.exe");

async function launchInstalled(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({ executablePath: appExe() });
  return { app, page: await getFirstWindow(app) };
}

async function expectLibraryOnScreen(page: Page): Promise<void> {
  await navigateTo(page, 'Projetos');
  await expect(page.getByText('Tese', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Revisão', { exact: true })).toBeVisible();
  await expect(page.getByText('Projeto antigo', { exact: true })).toHaveCount(0);
}

function dumpInstalledLibrary(name: string): LibraryDump {
  const db = openLibrary(path.join(USER_DATA, 'emma.db'));
  try {
    const dump = dumpLibrary(db, USER_DATA);
    fs.writeFileSync(test.info().outputPath(`${name}.json`), JSON.stringify(dump, null, 2));
    return dump;
  } finally {
    db.close();
  }
}

test('upgrading from the published release keeps the whole library', async () => {
  test.setTimeout(15 * 60 * 1000);
  refuseToTouchARealLibrary();

  await test.step('install the published release and let it create its library', async () => {
    install(OLD_INSTALLER);
    const { app } = await launchInstalled();
    await app.close();
  });

  await test.step('fill the library with every kind of data the old schema can hold', async () => {
    const target = openLibrary(path.join(USER_DATA, 'emma.db'));
    const source = buildFullLibrary(USER_DATA);
    try {
      const report = copyLibraryInto(source, target);
      fs.writeFileSync(test.info().outputPath('transfer-report.json'), JSON.stringify(report, null, 2));
    } finally {
      source.close();
      target.close();
    }
  });

  await test.step('set preferences and an API key through the published release', async () => {
    const { app, page } = await launchInstalled();
    await page.evaluate((prefs) => Object.entries(prefs).forEach(([k, v]) => localStorage.setItem(k, v)), PREFERENCES);
    // Through the app, so the key is encrypted by safeStorage the way a real install stores it.
    await page.evaluate((key) => window.electronAPI.invoke('settings:set', 'api_key_openai', key), API_KEY);
    await expectLibraryOnScreen(page);
    await app.close();
  });

  const before = dumpInstalledLibrary('before-upgrade');

  await test.step('install the new build over it, as the auto-updater does', async () => {
    install(NEW_INSTALLER, '--updated');
  });

  await test.step('the new version shows the library, the preferences and the API key', async () => {
    const { app, page } = await launchInstalled();
    const prefs = await page.evaluate(
      (keys) => Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])),
      Object.keys(PREFERENCES),
    );
    const key = await page.evaluate(() => window.electronAPI.invoke('settings:get', 'api_key_openai'));
    await expectLibraryOnScreen(page);
    await app.close();

    expect(prefs).toEqual(PREFERENCES);
    expect(key).toBe(API_KEY);
  });

  expect(findLostData(before, dumpInstalledLibrary('after-upgrade'))).toEqual([]);
});

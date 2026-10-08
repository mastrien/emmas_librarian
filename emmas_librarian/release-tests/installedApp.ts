import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getFirstWindow, navigateTo } from '../e2e-tests/helpers';
import { buildFullLibrary, copyLibraryInto, openLibrary } from './libraryTransfer';
import { dumpLibrary, type LibraryDump } from './libraryDump';

/**
 * The installed app, as the release tests drive it: silent NSIS installs, launches through Playwright,
 * and the library under its real data folder (installed apps have no switch for another one).
 */
export const INSTALL_DIR = process.env.RELEASE_TEST_INSTALL_DIR ?? path.join(os.tmpdir(), 'emma-release-test', 'app');
// Electron's userData for the installed app: %APPDATA%/<package name> on Windows (Linux: issue #17).
export const USER_DATA = path.join(process.env.APPDATA ?? '', 'emmas_librarian');
export const API_KEY = 'sk-release-test-0123456789';
export const PREFERENCES = { theme: 'dark', accent: 'green', emma_sidebar_width: '320' };

export const appExe = () => path.join(INSTALL_DIR, "Emma's Librarian.exe");

export function refuseToTouchARealLibrary(): void {
  if (process.env.CI === 'true' || process.env.RELEASE_TEST_ALLOW_REAL_LIBRARY === '1') return;
  throw new Error(
    `[ERR_RELEASE_TEST_REAL_LIBRARY] Refusing to run: it installs over "${INSTALL_DIR}" and rewrites "${USER_DATA}", ` +
      "the library of any Emma's Librarian installed here. Expected CI=true (GitHub runner) or RELEASE_TEST_ALLOW_REAL_LIBRARY=1 on a throwaway machine.",
  );
}

// STATUS_ACCESS_VIOLATION. The first install on a fresh GitHub runner exits with it now and then, without
// installing anything, for any of our installers (investigations/2026-10-v120-installer); later runs pass.
const INSTALLER_CRASH = 0xc0000005;

/** Silent NSIS install into INSTALL_DIR; extra args (e.g. --updated) are the ones electron-updater passes. */
export async function install(installer: string, ...args: string[]): Promise<void> {
  if (!fs.existsSync(installer)) {
    throw new Error(`[ERR_RELEASE_TEST_INSTALLER] Installer not found: "${installer}". Expected a NSIS setup .exe.`);
  }
  const first = runInstaller(installer, args);
  if (first.status === 0) return;
  // Retried once so the data check still runs, but reported: a crashing installer also hits real users.
  const result = first.status === INSTALLER_CRASH ? await retryAfterCrash(installer, args) : first;
  if (result.status === 0) return;
  throw new Error(
    `[ERR_RELEASE_TEST_INSTALL] "${path.basename(installer)} ${args.join(' ')}" exited with status=${result.status} ` +
      `signal=${result.signal} error=${result.error?.message}; app exe present=${fs.existsSync(appExe())}; ` +
      `stdout=${JSON.stringify(result.stdout)} stderr=${JSON.stringify(result.stderr)}. Expected status 0.`,
  );
}

// NSIS requires /D= last and unquoted.
const runInstaller = (installer: string, args: string[]) =>
  spawnSync(installer, [...args, '/S', `/D=${INSTALL_DIR}`], { encoding: 'utf-8', timeout: 300000 });

// Started again right away, the 9.0.0 installer crashed a second time (2026-10-09); runs a little later passed.
const RETRY_AFTER_CRASH_MS = 20000;

async function retryAfterCrash(installer: string, args: string[]): Promise<ReturnType<typeof runInstaller>> {
  const message = `${path.basename(installer)} crashed (0xC0000005) on its first run and was started again ${RETRY_AFTER_CRASH_MS / 1000} s later.`;
  test.info().annotations.push({ type: 'warning', description: message });
  console.log(`::warning title=Installer crashed::${message}`);
  await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_CRASH_MS));
  return runInstaller(installer, args);
}

export async function launchInstalled(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({ executablePath: appExe() });
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

const powershell = (script: string) =>
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf-8' }).trim();
// PowerShell single-quoted string: '' is one apostrophe.
const PROCESS_NAME = "Emma''s Librarian";

/** Whether an app process is running that Playwright did not start (e.g. reopened by the installer). */
export const appIsRunning = (): boolean =>
  powershell(`@(Get-Process -Name '${PROCESS_NAME}' -ErrorAction SilentlyContinue).Count`) !== '0';

/** Closes the app's windows as clicking X would, and ends whatever is left after 10 s. */
export async function closeRunningApp(): Promise<void> {
  powershell(
    `Get-Process -Name '${PROCESS_NAME}' -ErrorAction SilentlyContinue | % { $_.CloseMainWindow() | Out-Null }; exit 0`,
  );
  await waitUntil(() => !appIsRunning(), 10000, 'the app to close').catch(() => undefined);
  if (appIsRunning()) powershell(`Stop-Process -Name '${PROCESS_NAME}' -Force -ErrorAction SilentlyContinue; exit 0`);
}

/** Polls `condition` every second until it holds, or fails naming what it waited for. */
export async function waitUntil(condition: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`[ERR_RELEASE_TEST_TIMEOUT] Waited ${timeoutMs} ms for ${what}.`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

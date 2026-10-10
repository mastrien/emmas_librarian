import { test } from '@playwright/test';
import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { INSTALLER_CRASH, runInstallerOnce, type InstallerResult } from './installerRun';
import type { InstalledAppPlatform, InstallOptions } from './platformTypes';

/**
 * The installed app on Windows: silent NSIS installs into `installDir`, the library under
 * %APPDATA%/<package name>, processes found and closed through PowerShell.
 *
 * Usage:
 *   const platform = windowsInstall(process.env, 'C:\\temp\\emma-app');
 *   platform.install('emmas_librarian-setup-1.1.23.exe', { tolerateCrash: true });
 */
export function windowsInstall(env: NodeJS.ProcessEnv, installDir: string): InstalledAppPlatform {
  const appExecutable = path.join(installDir, "Emma's Librarian.exe");
  return {
    userData: path.join(env.APPDATA ?? '', 'emmas_librarian'),
    appExecutable,
    updateMetadataFile: 'latest.yml',
    installerExtension: '.exe',
    install: (installer, options) => installNsis(installer, installDir, appExecutable, options),
    appIsRunning: () =>
      powershell(`@(Get-Process -Name '${PROCESS_NAME}' -ErrorAction SilentlyContinue).Count`) !== '0',
    askAppToClose: () => {
      powershell(
        `Get-Process -Name '${PROCESS_NAME}' -ErrorAction SilentlyContinue | % { $_.CloseMainWindow() | Out-Null }; exit 0`,
      );
    },
    forceQuitApp: () => {
      powershell(`Stop-Process -Name '${PROCESS_NAME}' -Force -ErrorAction SilentlyContinue; exit 0`);
    },
  };
}

const powershell = (script: string) =>
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf-8' }).trim();
// PowerShell single-quoted string: '' is one apostrophe.
const PROCESS_NAME = "Emma''s Librarian";

// Started again right away, the update-flow test's first installer crashed a second time (2026-10-09); a run
// 20 s later passed.
const RETRY_AFTER_CRASH_MS = 20000;

/** Silent NSIS install into installDir. */
function installNsis(
  installer: string,
  installDir: string,
  appExecutable: string,
  { args = [], tolerateCrash = false }: InstallOptions = {},
): void {
  if (!fs.existsSync(installer)) {
    throw new Error(`[ERR_RELEASE_TEST_INSTALLER] Installer not found: "${installer}". Expected a NSIS setup .exe.`);
  }
  const { result, crashedFirst } = runInstallerOnce(
    () => runInstaller(installer, installDir, args),
    tolerateCrash,
    () => sleepSync(RETRY_AFTER_CRASH_MS),
  );
  // Reported, not hidden: a crashing installer also hits real users.
  if (crashedFirst && result.status === 0) reportInstallerCrash(installer);
  if (result.status === 0) return;
  const notRetried = crashedFirst && !tolerateCrash;
  throw new Error(installFailureMessage({ installer, args, result, notRetried, appExecutable }));
}

// NSIS requires /D= last and unquoted.
const runInstaller = (installer: string, installDir: string, args: string[]): InstallerResult =>
  spawnSync(installer, [...args, '/S', `/D=${installDir}`], { encoding: 'utf-8', timeout: 300000 });

// The installs run synchronously (spawnSync), so the wait before a retry blocks too.
const sleepSync = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function reportInstallerCrash(installer: string): void {
  const message = `${path.basename(installer)} crashed (0xC0000005) on its first run and was started again ${RETRY_AFTER_CRASH_MS / 1000} s later.`;
  test.info().annotations.push({ type: 'warning', description: message });
  console.log(`::warning title=Installer crashed::${message}`);
}

interface InstallFailure {
  installer: string;
  args: string[];
  result: InstallerResult;
  notRetried: boolean;
  appExecutable: string;
}

function installFailureMessage({ installer, args, result, notRetried, appExecutable }: InstallFailure): string {
  const note = notRetried
    ? ` (0x${INSTALLER_CRASH.toString(16)}: the installer of the build under test crashed, not retried)`
    : '';
  return (
    `[ERR_RELEASE_TEST_INSTALL] "${path.basename(installer)} ${args.join(' ')}" exited with status=${result.status}${note} ` +
    `signal=${result.signal} error=${result.error?.message}; app exe present=${fs.existsSync(appExecutable)}; ` +
    `stdout=${JSON.stringify(result.stdout)} stderr=${JSON.stringify(result.stderr)}. Expected status 0.`
  );
}

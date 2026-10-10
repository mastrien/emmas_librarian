// Runs an installer at Medium integrity from the elevated runner session. The runner's user is an administrator with
// a High integrity token and "runas /trustlevel" left it High (round 3, first attempt), so medium.ps1 builds the
// UAC-filtered, Medium token itself. What the process really got is recorded next to the exit status.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { hex, sleep } from '../2026-10-v120-installer/lib.mjs';

const LAUNCHER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'medium.ps1');
const WAIT_LIMIT_MS = 300000;

/**
 * Installs silently at Medium integrity and reports the exit status plus the integrity label and the Administrators
 * group state the process really had (so a run that silently stayed High is visible in the result).
 * Usage: const run = await installAtMediumIntegrity(installerPath, installDir);
 */
export async function installAtMediumIntegrity(installer, dir) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'medium-'));
  const files = { exit: path.join(work, 'exit.txt'), integrity: path.join(work, 'integrity.txt'), admin: path.join(work, 'admin.txt') };
  const script = path.join(work, 'run.cmd');
  fs.writeFileSync(script, commandScript(installer, dir, files));
  const started = Date.now();
  const launch = spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', LAUNCHER, '-CommandLine', `cmd.exe /c "${script}"`],
    { encoding: 'utf-8', timeout: WAIT_LIMIT_MS + 30000 },
  );
  // A failed launch (token or CreateProcessWithTokenW error) exits non-zero: do not wait out the whole limit for it.
  const status = launch.status === 0 ? await waitForExitStatus(files.exit, started) : null;
  return {
    status,
    statusHex: hex(status),
    ms: Date.now() - started,
    integrity: readTrimmed(files.integrity),
    adminGroup: readTrimmed(files.admin),
    launchError: status === null ? `${launch.stderr ?? ''}${launch.stdout ?? ''}${launch.error?.message ?? ''}`.trim() : undefined,
  };
}

/** The .cmd the restricted process runs: records its own token, installs, records the exit status. */
function commandScript(installer, dir, files) {
  return (
    `@echo off\r\n` +
    `whoami /groups | findstr /C:"Mandatory Label" > "${files.integrity}"\r\n` +
    `whoami /groups | findstr /C:"BUILTIN\\Administrators" > "${files.admin}"\r\n` +
    `"${installer}" /S /D=${dir}\r\n` +
    `echo %ERRORLEVEL% > "${files.exit}"\r\n`
  );
}

async function waitForExitStatus(exitFile, started) {
  while (Date.now() - started < WAIT_LIMIT_MS) {
    const text = readTrimmed(exitFile);
    if (text !== null && text !== '') return Number.parseInt(text, 10);
    await sleep(500);
  }
  return null;
}

const readTrimmed = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf-8').trim() : null);

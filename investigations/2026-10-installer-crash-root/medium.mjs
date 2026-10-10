// Runs an installer at Medium integrity from the elevated runner session. The runner's user is an administrator with
// a High integrity token; "runas /trustlevel:0x20000" (SAFER "Basic User") starts the process with a restricted
// token, which is what a normal, non-elevated user session looks like to the installer's UAC plugin.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { hex, sleep } from '../2026-10-v120-installer/lib.mjs';

const BASIC_USER = '0x20000';
const WAIT_LIMIT_MS = 300000;

/**
 * Installs silently at Medium integrity and reports the exit status plus the integrity label the process really had
 * (so a run that silently stayed High is visible in the result).
 * Usage: const run = await installAtMediumIntegrity(installerPath, installDir);
 */
export async function installAtMediumIntegrity(installer, dir) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'medium-'));
  const exitFile = path.join(work, 'exit.txt');
  const integrityFile = path.join(work, 'integrity.txt');
  const script = path.join(work, 'run.cmd');
  fs.writeFileSync(
    script,
    `@echo off\r\nwhoami /groups | findstr /C:"Mandatory Label" > "${integrityFile}"\r\n` +
      `"${installer}" /S /D=${dir}\r\necho %ERRORLEVEL% > "${exitFile}"\r\n`,
  );
  const started = Date.now();
  const launch = spawnSync('runas', [`/trustlevel:${BASIC_USER}`, `cmd.exe /c "${script}"`], { encoding: 'utf-8', timeout: 60000 });
  const status = await waitForExitStatus(exitFile, started);
  return {
    status,
    statusHex: hex(status),
    ms: Date.now() - started,
    integrity: readTrimmed(integrityFile),
    launchError: status === null ? `${launch.stderr ?? ''}${launch.stdout ?? ''}${launch.error?.message ?? ''}`.trim() : undefined,
  };
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

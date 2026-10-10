// Runs an installer without elevation from the elevated runner session, the way Windows does it: a scheduled task of
// the same user with RunLevel Limited, which gets the UAC-filtered Medium token (Administrators deny-only).
// Two earlier ways failed on the runners: "runas /trustlevel" left the process at High (round 3), and a token built by
// hand (CreateRestrictedToken + CreateProcessWithTokenW) started a cmd.exe that never ran its script (3b, 3c).
// What the process really got is recorded next to the exit status, together with the machine's EnableLUA.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hex, powershell, sleep } from '../2026-10-v120-installer/lib.mjs';

const TASK_NAME = 'emma-installer-medium';
const WAIT_LIMIT_MS = 150000; // an install takes 35-60 s on a runner

/**
 * Installs silently in a Limited-run-level task and reports the exit status plus the integrity label and the
 * Administrators group state the process really had (so a run that stayed High is visible in the result).
 * Usage: const run = await installAtMediumIntegrity(installerPath, installDir);
 */
export async function installAtMediumIntegrity(installer, dir) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'medium-'));
  const files = { exit: path.join(work, 'exit.txt'), integrity: path.join(work, 'integrity.txt'), admin: path.join(work, 'admin.txt') };
  const script = path.join(work, 'run.cmd');
  fs.writeFileSync(script, commandScript(installer, dir, files));
  const started = Date.now();
  const launchError = startLimitedTask(script);
  const status = launchError ? null : await waitForExitStatus(files.exit, started);
  const taskResult = launchError ? null : taskInfo();
  removeTask();
  return {
    status,
    statusHex: hex(status),
    ms: Date.now() - started,
    integrity: readTrimmed(files.integrity),
    adminGroup: readTrimmed(files.admin),
    enableLua: enableLua(),
    taskResult,
    launchError: launchError ?? (status === null ? 'the task did not write an exit status in time' : undefined),
  };
}

/** The .cmd the limited process runs: records its own token, installs, records the exit status. */
function commandScript(installer, dir, files) {
  return (
    `@echo off\r\n` +
    `whoami /groups | findstr /C:"Mandatory Label" > "${files.integrity}"\r\n` +
    `whoami /groups | findstr /C:"BUILTIN\\Administrators" > "${files.admin}"\r\n` +
    `"${installer}" /S /D=${dir}\r\n` +
    `echo %ERRORLEVEL% > "${files.exit}"\r\n`
  );
}

/** Registers and starts the task; returns an error text, or null when it was started. */
function startLimitedTask(script) {
  const register =
    `$ErrorActionPreference = 'Stop'; ` +
    `$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c "${script}"'; ` +
    `$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\\$env:USERNAME" -LogonType Interactive -RunLevel Limited; ` +
    `Register-ScheduledTask -TaskName '${TASK_NAME}' -Action $action -Principal $principal -Force | Out-Null; ` +
    `Start-ScheduledTask -TaskName '${TASK_NAME}'; 'started'`;
  try {
    return powershell(register).includes('started') ? null : 'Start-ScheduledTask printed nothing';
  } catch (error) {
    return String(error.stderr ?? error.message).trim().slice(0, 600);
  }
}

const taskInfo = () => safePowershell(`Get-ScheduledTaskInfo -TaskName '${TASK_NAME}' | Select-Object LastTaskResult, LastRunTime | ConvertTo-Json -Compress`);
const enableLua = () => safePowershell(`(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System').EnableLUA`);
const removeTask = () => safePowershell(`Unregister-ScheduledTask -TaskName '${TASK_NAME}' -Confirm:$false; exit 0`);

function safePowershell(script) {
  try {
    return powershell(script).trim() || null;
  } catch {
    return null;
  }
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

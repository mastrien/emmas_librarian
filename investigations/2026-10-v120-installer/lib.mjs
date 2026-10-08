// Shared helpers for the installer experiments. Windows only; run on throwaway GitHub runners
// (installing touches %APPDATA%/emmas_librarian and the per-user uninstall registry).
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const APP_EXE = "Emma's Librarian.exe";
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs a NSIS installer silently into `dir` and waits; status 0xC0000005 is the crash seen in PR #19. */
export function installSync(installer, dir, extraArgs = []) {
  const started = Date.now();
  // NSIS requires /D= last and unquoted.
  const result = spawnSync(installer, [...extraArgs, '/S', `/D=${dir}`], { timeout: 300000 });
  return { status: result.status, statusHex: hex(result.status), ms: Date.now() - started, error: result.error?.message };
}

/** Starts a NSIS installer without waiting, as electron-updater does on quit. */
export function installAsync(installer, dir, extraArgs = []) {
  const started = Date.now();
  const child = spawn(installer, [...extraArgs, '/S', `/D=${dir}`], { detached: false, stdio: 'ignore' });
  const done = new Promise((resolve) =>
    child.on('exit', (status) => resolve({ status, statusHex: hex(status), ms: Date.now() - started })),
  );
  return { child, done };
}

export const hex = (status) => (typeof status === 'number' ? `0x${(status >>> 0).toString(16).toUpperCase()}` : null);

/** The version Windows reports for the installed exe (electron-builder writes the app version there). */
export function exeVersion(dir) {
  const exe = path.join(dir, APP_EXE);
  if (!fs.existsSync(exe)) return null;
  return powershell(`(Get-Item -LiteralPath '${exe.replace(/'/g, "''")}').VersionInfo.ProductVersion`).trim();
}

/** Every file under `dir` with size and sha256, to diff an install against a clean one. */
export function manifest(dir) {
  if (!fs.existsSync(dir)) return {};
  const files = fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile());
  return Object.fromEntries(
    files.map((entry) => {
      const file = path.join(entry.parentPath, entry.name);
      const bytes = fs.readFileSync(file);
      const sha = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);
      return [path.relative(dir, file).split(path.sep).join('/'), `${bytes.length}:${sha}`];
    }),
  );
}

/** Files that differ between an install and a clean install of the expected version. */
export function diffManifests(actual, clean) {
  const missing = Object.keys(clean).filter((f) => !(f in actual));
  const extra = Object.keys(actual).filter((f) => !(f in clean));
  const changed = Object.keys(clean).filter((f) => f in actual && actual[f] !== clean[f]);
  return { missing, extra, changed };
}

/** Starts the installed app like a person would (no Playwright), keeping its console output. */
export function startApp(dir) {
  const child = spawn(path.join(dir, APP_EXE), [], {
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  child.on('error', (err) => (output += `\n[spawn error] ${err.message}`));
  return { child, output: () => output };
}

const PROCESS_NAME = "Emma''s Librarian"; // PowerShell single-quoted: '' is one apostrophe

/** Closes the app's windows (what clicking X does), then makes sure no app process is left. */
export async function quitApp() {
  powershell(`Get-Process -Name '${PROCESS_NAME}' -ErrorAction SilentlyContinue | ForEach-Object { $_.CloseMainWindow() | Out-Null }; exit 0`);
  for (let i = 0; i < 20 && appRunning(); i++) await sleep(500);
  if (appRunning()) powershell(`Stop-Process -Name '${PROCESS_NAME}' -Force -ErrorAction SilentlyContinue; exit 0`);
}

export const appRunning = () =>
  powershell(`@(Get-Process -Name '${PROCESS_NAME}' -ErrorAction SilentlyContinue).Count`).trim() !== '0';

/**
 * "Application Error" events (ID 1000) since `since`: which program and module crashed. Other providers
 * also log ID 1000 (WmiApRpl did on the runners), hence the provider filter.
 */
export function crashEvents(since) {
  const script =
    `$e = Get-WinEvent -FilterHashtable @{LogName='Application'; ProviderName='Application Error'; Id=1000; ` +
    `StartTime=[datetime]'${since.toISOString()}'} -ErrorAction SilentlyContinue; ` +
    `@($e | ForEach-Object { [pscustomobject]@{ time=$_.TimeCreated.ToString('o'); app=$_.Properties[0].Value; ` +
    `module=$_.Properties[3].Value; moduleVersion=$_.Properties[4].Value; exception=$_.Properties[6].Value; ` +
    `offset=$_.Properties[7].Value } }) | ConvertTo-Json -Compress; exit 0`;
  const json = powershell(script).trim();
  if (!json) return [];
  const parsed = JSON.parse(json);
  return Array.isArray(parsed) ? parsed : [parsed]; // Windows PowerShell unwraps one-item arrays
}

/**
 * Asks Windows Error Reporting to keep a minidump of any crashing program in `folder` (machine-wide; runners
 * are throwaway). Must run before the installers.
 */
export function enableCrashDumps(folder) {
  fs.mkdirSync(folder, { recursive: true });
  const key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting\\LocalDumps';
  powershell(
    `New-Item -Path '${key}' -Force | Out-Null; ` +
      `New-ItemProperty -Path '${key}' -Name DumpFolder -PropertyType ExpandString -Value '${folder}' -Force | Out-Null; ` +
      `New-ItemProperty -Path '${key}' -Name DumpType -PropertyType DWord -Value 1 -Force | Out-Null; exit 0`,
  );
}

/** The faulting module and stack of each minidump in `folder`, from cdb's !analyze (x86 cdb: NSIS is 32-bit). */
export function analyzeDumps(folder) {
  if (!fs.existsSync(folder)) return [];
  const kits = 'C:\\Program Files (x86)\\Windows Kits\\10\\Debuggers';
  return fs
    .readdirSync(folder)
    .filter((name) => name.endsWith('.dmp'))
    .map((name) => {
      const dump = path.join(folder, name);
      const cdb = [path.join(kits, 'x86', 'cdb.exe'), path.join(kits, 'x64', 'cdb.exe')].find((p) => fs.existsSync(p));
      if (!cdb) return { dump: name, analysis: 'cdb.exe not found under Windows Kits' };
      const out = spawnSync(cdb, ['-z', dump, '-c', '!analyze -v; kb 30; lm; q'], { encoding: 'utf-8', timeout: 300000 });
      const text = `${out.stdout ?? ''}${out.stderr ?? ''}`;
      const keep = text.split(/\r?\n/).filter((line) => /FAULTING|MODULE_NAME|IMAGE_NAME|EXCEPTION_CODE|SYMBOL_NAME|FAILURE_BUCKET|ExceptionAddress|^\s*[0-9a-f]{8} [0-9a-f]{8}/i.test(line));
      return { dump: name, analysis: keep.slice(0, 80).join('\n') };
    });
}

/** The app's own log (electron-log), from %APPDATA%/emmas_librarian/logs/main.log. */
export function appLogTail(lines = 40) {
  const log = path.join(process.env.APPDATA ?? '', 'emmas_librarian', 'logs', 'main.log');
  if (!fs.existsSync(log)) return '';
  return fs.readFileSync(log, 'utf-8').split(/\r?\n/).slice(-lines).join('\n');
}

const powershell = (script) =>
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf-8' });

export function writeResult(name, result) {
  const dir = path.resolve('results');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

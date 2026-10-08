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

/** Closes the app's windows (what clicking X does), then makes sure no app process is left. */
export async function quitApp() {
  spawnSync('taskkill', ['/IM', APP_EXE, '/T'], { stdio: 'ignore' });
  for (let i = 0; i < 20 && appRunning(); i++) await sleep(500);
  if (appRunning()) spawnSync('taskkill', ['/IM', APP_EXE, '/T', '/F'], { stdio: 'ignore' });
}

export const appRunning = () =>
  execFileSync('tasklist', ['/FI', `IMAGENAME eq ${APP_EXE}`, '/NH'], { encoding: 'utf-8' }).includes(APP_EXE);

/** Application crash events (Event ID 1000) since `since`: which program and which module failed. */
export function crashEvents(since) {
  const script =
    `Get-WinEvent -FilterHashtable @{LogName='Application'; Id=1000; StartTime=[datetime]'${since.toISOString()}'} ` +
    `-ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ time=$_.TimeCreated.ToString('o'); ` +
    `app=$_.Properties[0].Value; module=$_.Properties[3].Value; moduleVersion=$_.Properties[4].Value; ` +
    `exception=$_.Properties[6].Value; offset=$_.Properties[7].Value } } | ConvertTo-Json -Compress`;
  const json = powershell(script).trim();
  if (!json) return [];
  const parsed = JSON.parse(json);
  return Array.isArray(parsed) ? parsed : [parsed];
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

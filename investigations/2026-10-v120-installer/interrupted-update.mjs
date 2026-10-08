// H2: reopening the app while the updater's installer is still running (as on 2026-10-01, ~9 s after it
// started) aborts the install or leaves files of two versions.
// Usage: node interrupted-update.mjs <reopen-delay-seconds | none> <attempt>
// Installers: env INSTALLER_PUBLISHED_1_1_23 (old) and INSTALLER_REBUILT_1_2_0 (update).
import os from 'node:os';
import path from 'node:path';
import {
  appLogTail,
  crashEvents,
  diffManifests,
  exeVersion,
  installAsync,
  installSync,
  manifest,
  quitApp,
  sleep,
  startApp,
  writeResult,
} from './lib.mjs';

const OLD = process.env.INSTALLER_PUBLISHED_1_1_23;
const UPDATE = process.env.INSTALLER_REBUILT_1_2_0;
const [delayArg, attempt] = process.argv.slice(2);
const reopenAfterMs = delayArg === 'none' ? null : Number(delayArg) * 1000;
// How long the person kept the reopened app before closing it again (23:12:41.7 -> 23:12:54.2).
const KEEP_OPEN_MS = 12500;
const MAX_CYCLES = 3;

const root = path.join(os.tmpdir(), 'interrupted');
const appDir = path.join(root, 'app');
const since = new Date();

// A clean 1.2.0 install first, only to know which files a good install has (the next install removes it).
const cleanInstall = installSync(UPDATE, path.join(root, 'clean'));
const clean = manifest(path.join(root, 'clean'));

const oldInstall = installSync(OLD, appDir);
// The person was using 1.1.23: it creates the library and is open when the update is ready.
const first = startApp(appDir);
await sleep(15000);
await quitApp();

const cycles = [];
for (let cycle = 1; cycle <= MAX_CYCLES && exeVersion(appDir) !== '1.2.0'; cycle++) {
  cycles.push(await updateCycle(cycle));
}

// After the last cycle the person came back ~58 s later.
const final = startApp(appDir);
await sleep(30000);
const finalOutput = final.output();
await quitApp();

writeResult(`interrupted-${delayArg}-${attempt}`, {
  experiment: 'interrupted-update',
  reopenAfterMs,
  attempt: Number(attempt),
  cleanInstall,
  oldInstall,
  firstRunOutput: first.output().slice(-2000),
  cycles,
  finalVersion: exeVersion(appDir),
  finalDiffAgainstClean1_2_0: diffManifests(manifest(appDir), clean),
  finalStartOutput: finalOutput.slice(-4000),
  finalStartFailed: /Error during app startup|Failed to start app|Startup Error/.test(finalOutput),
  appLogTail: appLogTail(),
  crashEvents: crashEvents(since),
});

// One round of the 2026-10-01 log: the updater runs the installer on quit; the person reopens the app
// `reopenAfterMs` later (not in the last round, like the log) and closes it after a while.
async function updateCycle(cycle) {
  const installer = installAsync(UPDATE, appDir, ['--updated']);
  const reopens = reopenAfterMs !== null && cycle < MAX_CYCLES;
  let reopened = null;
  if (reopens) {
    await sleep(reopenAfterMs);
    reopened = { versionWhenReopened: exeVersion(appDir), app: startApp(appDir) };
  }
  const result = await Promise.race([installer.done, sleep(300000).then(() => ({ status: 'timeout' }))]);
  // Kept open KEEP_OPEN_MS from the moment it was reopened, whether the installer ended before or after.
  const sinceStart = typeof result.ms === 'number' ? result.ms : 300000;
  if (reopens) await sleep(Math.max(0, reopenAfterMs + KEEP_OPEN_MS - sinceStart));
  await quitApp();
  return {
    cycle,
    installer: result,
    reopened: reopened && { versionWhenReopened: reopened.versionWhenReopened, output: reopened.app.output().slice(-1500) },
    versionAfter: exeVersion(appDir),
  };
}

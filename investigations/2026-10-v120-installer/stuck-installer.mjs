// H2 follow-up: round 2 reproduced the first two rounds of 2026-10-01 (app reopened while the update
// installed: the installer waits, later ones exit with 2, the app stays 1.1.23). Does an installer left
// waiting resume later and mix files, or touch the install while the final 1.2.0 starts (the failure)?
// Timing follows the log: each round the updater starts the installer as the app quits; the person reopens
// the app `reopen` s later and keeps it 12.5 s; after the third round they come back 58 s later.
// Installers are never killed here, so a stuck one shows when (and whether) it finishes.
// Usage: node stuck-installer.mjs <reopen-delay-seconds> <attempt>
import os from 'node:os';
import path from 'node:path';
import {
  appLogTail,
  classifyAgainst,
  crashEvents,
  exeVersion,
  installAsync,
  installSync,
  manifest,
  quitApp,
  sleep,
  startApp,
  writeResult,
} from './lib.mjs';
import fs from 'node:fs';

const OLD = process.env.INSTALLER_PUBLISHED_1_1_23;
const UPDATE = process.env.INSTALLER_REBUILT_1_2_0;
const [delayArg, attempt] = process.argv.slice(2);
const reopenAfterMs = Number(delayArg) * 1000;
const KEEP_OPEN_MS = 12500; // 23:12:41.7 -> 23:12:54.2
const FINAL_RETURN_MS = 58000; // 23:13:15.7 -> 23:14:13.7

const root = path.join(os.tmpdir(), 'stuck');
const appDir = path.join(root, 'app');
const t0 = Date.now();
const at = () => Date.now() - t0;

// Clean installs of both versions, only to classify the final files (each install removes the previous).
installSync(OLD, path.join(root, 'clean-old'));
const cleanOld = manifest(path.join(root, 'clean-old'));
installSync(UPDATE, path.join(root, 'clean-new'));
const cleanNew = manifest(path.join(root, 'clean-new'));

const oldInstall = installSync(OLD, appDir);
const first = startApp(appDir);
await sleep(15000);
await quitApp();

const installers = [];
const rounds = [];
for (let round = 1; round <= 3; round++) {
  installers.push(startInstaller(round));
  if (round === 3) break;
  await sleep(reopenAfterMs);
  const versionWhenReopened = exeVersion(appDir);
  const reopened = fs.existsSync(path.join(appDir, "Emma's Librarian.exe")) ? startApp(appDir) : null;
  await sleep(KEEP_OPEN_MS);
  await quitApp();
  rounds.push({ round, versionWhenReopened, reopenedOutput: reopened?.output().slice(-800) ?? 'exe missing' });
}

await sleep(FINAL_RETURN_MS);
const aliveAtFinalStart = installers.filter((i) => i.exit === null).map((i) => i.round);
const finalVersionAtStart = exeVersion(appDir);
const final = startApp(appDir);
await sleep(30000);
const finalOutput = final.output();
await quitApp();

// Give any installer still waiting up to 4 min to finish now that no app is open.
const deadline = Date.now() + 240000;
while (installers.some((i) => i.exit === null) && Date.now() < deadline) await sleep(2000);

writeResult(`stuck-${delayArg}-${attempt}`, {
  experiment: 'stuck-installer',
  reopenAfterMs,
  attempt: Number(attempt),
  oldInstall,
  firstRunOutput: first.output().slice(-800),
  rounds,
  installers: installers.map(({ round, startedAt, exit }) => ({ round, startedAt, exit })),
  aliveAtFinalStart,
  finalVersionAtStart,
  finalStartOutput: finalOutput.slice(-4000),
  finalStartFailed: /Error during app startup|Failed to start app|Startup Error|SqliteError/.test(finalOutput),
  finalVersionAfterAll: exeVersion(appDir),
  finalFilesAfterAll: classifyAgainst(manifest(appDir), cleanOld, cleanNew),
  appLogTail: appLogTail(60),
  crashEvents: crashEvents(new Date(t0)),
});
// An installer still waiting keeps Node alive; round 2's 3 s runners hit the job timeout that way.
process.exit(0);

function startInstaller(round) {
  const entry = { round, startedAt: at(), exit: null };
  const { done } = installAsync(UPDATE, appDir, ['--updated']);
  done.then((result) => (entry.exit = { ...result, at: at() }));
  return entry;
}

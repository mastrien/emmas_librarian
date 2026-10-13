// TEMPORARY diagnostic for issue #37 (AppImage crash: int3 in PartitionAlloc FreelistCorruptionDetected, ubuntu-24.04).
// Launches one variant `rounds` times under xvfb, lets it run `dwellMs`, closes it, and counts the rounds where the
// process died on its own (signal or early exit). Core dumps go to a file (core_pattern set by the workflow, apport off),
// so a crash no longer wedges the exit; the workflow then runs gdb on the cores.
// Usage (under xvfb-run): node crash-bisect.mjs <name> <rounds> <dwellMs> <outDir> <command> [args...]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [name, roundsArg, dwellArg, outDir, command, ...args] = process.argv.slice(2);
const rounds = Number(roundsArg);
const dwellMs = Number(dwellArg);
if (!name || !rounds || !dwellMs || !outDir || !command) {
  throw new Error(`Usage: crash-bisect.mjs <name> <rounds> <dwellMs> <outDir> <command> [args...]. Got ${process.argv.slice(2)}`);
}
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function oneRound(round) {
  const configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-bisect-'));
  const env = { ...process.env, XDG_CONFIG_HOME: configHome };
  const child = spawn(command, args, { env, stdio: ['ignore', 'ignore', 'ignore'], detached: true });
  let died = null;
  child.once('exit', (code, signal) => (died = { code, signal }));
  await sleep(dwellMs);
  const diedEarly = died;
  // SIGKILL, not SIGTERM: on SIGTERM Chromium's children abort with a FATAL log (HandleFatal, int3) when they lose
  // the parent, which looked like a crash in every round (run 38327759502). The group is ours: pkill -f would match
  // this script's own command line, which carries the app path.
  try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
  await Promise.race([new Promise((r) => child.once('exit', r)), sleep(5000)]);
  fs.rmSync(configHome, { recursive: true, force: true });
  return diedEarly;
}

// The kernel names every trap it saw. The AppImage's top process is its runtime, so its exit status is not the app's.
let seenTraps = 0;
function newTraps() {
  const lines = spawnSync('sudo', ['dmesg']).stdout.toString().split(String.fromCharCode(10)).filter((l) => l.includes('traps:'));
  const fresh = lines.slice(seenTraps).map((l) => (l.match(/in [^\s\[]+\[([0-9a-f]+),/) ?? [])[1] ?? l);
  seenTraps = lines.length;
  return fresh;
}
newTraps();
let crashes = 0;
for (let round = 1; round <= rounds; round++) {
  const early = await oneRound(round);
  const traps = newTraps();
  if (early || traps.length) crashes++;
  console.log(`[${name}] round ${round}: ${early ? `DIED code=${early.code} signal=${early.signal}` : 'alive'} traps=[${traps}]`);
  await sleep(1000);
}
console.log(`[${name}] ${crashes} early death(s) in ${rounds} rounds`);

// H1: does the NSIS installer crash (0xC0000005) on a fresh runner, and which one?
// Usage: node install-crash-rate.mjs <first-label> <attempt>
// Installers come from env INSTALLER_<LABEL> (published_1_1_23, rebuilt_1_2_0, current).
import os from 'node:os';
import path from 'node:path';
import { analyzeDumps, crashEvents, enableCrashDumps, installSync, writeResult } from './lib.mjs';

const LABELS = ['published-1.1.23', 'rebuilt-1.2.0', 'current'];
const installerOf = (label) => process.env[`INSTALLER_${label.replace(/[-.]/g, '_').toUpperCase()}`];

const [first, attempt] = process.argv.slice(2);
if (!LABELS.includes(first)) throw new Error(`Unknown first installer "${first}". Expected one of ${LABELS.join(', ')}.`);

// The first run is the one that matters (fresh runner); six more alternate all three installers.
const order = [first, ...Array.from({ length: 6 }, (_, i) => LABELS[i % LABELS.length])];
const dumps = path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'dumps');
enableCrashDumps(dumps);
const since = new Date();
const runs = order.map((label, i) => {
  const dir = path.join(os.tmpdir(), 'crash-rate', `${i}-${label}`);
  const run = installSync(installerOf(label), dir);
  console.log(`${i} ${label}: ${run.statusHex} in ${run.ms} ms`);
  return { order: i, label, ...run };
});

writeResult(`crash-rate-${first}-${attempt}`, {
  experiment: 'crash-rate',
  first,
  attempt: Number(attempt),
  runner: os.release(),
  runs,
  crashEvents: crashEvents(since),
  dumps: analyzeDumps(dumps),
});

// Prints one line per runner: mode, first-install status, retries and what else was busy, then the crash counts.
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('Missing results folder. Expected: node summarize.mjs <folder with the result JSON files>.');
const files = fs.readdirSync(root, { recursive: true }).filter((f) => String(f).endsWith('.json'));
const rows = files.map((f) => JSON.parse(fs.readFileSync(path.join(root, String(f)), 'utf-8')));
rows.sort((a, b) => String(a.label).localeCompare(String(b.label)) || a.mode.localeCompare(b.mode) || a.attempt - b.attempt);
for (const r of rows) {
  const reinstalls = r.series ? ` recovery=[${r.series.recovery}] reinstalls=[${r.series.reinstalls}]` : '';
  const retry = r.retried ? ` now=${r.retried.immediate.statusHex} +20s=${r.retried.later.statusHex}` : '';
  const setup = [].concat(r.snapshot.setupLike ?? []).join(',');
  const folders = r.first.defaultFolders ? ` default-folders=${JSON.stringify(r.first.defaultFolders)}` : '';
  console.log(`${r.label ?? ''} ${r.mode} #${r.attempt}: ${r.first.statusHex} in ${r.first.ms} ms; uptime ${r.snapshot.uptimeSeconds}s; setup-like=[${setup}]${retry}${reinstalls}${folders}`);
}
for (const r of rows.filter((row) => row.crashed)) printCrashDetail(r);

/** What a crashed first install left in %TEMP% and, with Process Monitor, its last events before exiting. */
function printCrashDetail(r) {
  console.log(`
--- ${r.mode} #${r.attempt} crashed`);
  for (const folder of r.afterFirst.nsisTemp) console.log(`  ${folder.folder}: ${[].concat(folder.files).join(' ')}`);
  for (const e of (r.trace?.last ?? []).slice(-25)) console.log(`  ${e.time} ${e.operation} ${e.path} -> ${e.result} ${e.detail}`.slice(0, 260));
}

/** Crash counts per installer label and mode, e.g. "patched plain: 0 of 40". */
const groups = {};
for (const r of rows) {
  const key = `${r.label ?? 'installer'} ${r.mode}`;
  groups[key] ??= { crashed: 0, total: 0 };
  groups[key].total += 1;
  if (r.crashed) groups[key].crashed += 1;
}
console.log('');
for (const [key, g] of Object.entries(groups)) console.log(`${key}: ${g.crashed} of ${g.total} first installs crashed`);

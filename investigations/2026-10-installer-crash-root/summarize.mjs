// Prints one line per runner: mode, first-install status, retries and what else was busy, then the crash counts.
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('Missing results folder. Expected: node summarize.mjs <folder with the result JSON files>.');
const files = fs.readdirSync(root, { recursive: true }).filter((f) => String(f).endsWith('.json'));
const rows = files.map((f) => JSON.parse(fs.readFileSync(path.join(root, String(f)), 'utf-8')));
rows.sort((a, b) => a.mode.localeCompare(b.mode) || a.attempt - b.attempt);
for (const r of rows) {
  const retry = r.retried ? ` now=${r.retried.immediate.statusHex} +20s=${r.retried.later.statusHex}` : '';
  const setup = [].concat(r.snapshot.setupLike ?? []).join(',');
  console.log(`${r.mode} #${r.attempt}: ${r.first.statusHex} in ${r.first.ms} ms; uptime ${r.snapshot.uptimeSeconds}s; setup-like=[${setup}]${retry}${r.first.integrity ? ` integrity=${r.first.integrity.replace(/s+/g, " ").slice(0, 70)}` : ""}`);
}
for (const r of rows.filter((row) => row.crashed)) printCrashDetail(r);

/** What a crashed first install left in %TEMP% and, with Process Monitor, its last events before exiting. */
function printCrashDetail(r) {
  console.log(`
--- ${r.mode} #${r.attempt} crashed`);
  for (const folder of r.afterFirst.nsisTemp) console.log(`  ${folder.folder}: ${[].concat(folder.files).join(' ')}`);
  for (const e of (r.trace?.last ?? []).slice(-25)) console.log(`  ${e.time} ${e.operation} ${e.path} -> ${e.result} ${e.detail}`.slice(0, 260));
}

const crashed = rows.filter((r) => r.crashed);
const of = (mode) => crashed.filter((r) => r.mode === mode).length;
console.log(`\n${crashed.length} of ${rows.length} first installs crashed (plain ${of('plain')}, cdb ${of('cdb')}).`);

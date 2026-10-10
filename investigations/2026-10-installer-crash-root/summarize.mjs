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
  console.log(`${r.mode} #${r.attempt}: ${r.first.statusHex} in ${r.first.ms} ms; uptime ${r.snapshot.uptimeSeconds}s; setup-like=[${setup}]${retry}`);
}
const crashed = rows.filter((r) => r.crashed);
const of = (mode) => crashed.filter((r) => r.mode === mode).length;
console.log(`\n${crashed.length} of ${rows.length} first installs crashed (plain ${of('plain')}, cdb ${of('cdb')}).`);

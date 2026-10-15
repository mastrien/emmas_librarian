// Runs probe.ps1 through each launch path of launch-variants.mjs and prints which inherited attributes differ.
// Round 7 left `cmd /c "installer"` as the only path with no crash (0 of 50) while a PowerShell parent, `cmd /c start`
// and NUL handles did not help; this shows what that path hands the child differently.
// Usage: node probe-launch.mjs   (PROBE_SHELL overrides the PowerShell executable, default: pwsh from PATH)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installWithVariant } from '../2026-10-installer-crash-root/launch-variants.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.resolve('results');
const VARIANTS = ['async', 'via-cmd', 'cmd-nul', 'cmd-start', 'stdio-ignore', 'hide', 'detached', 'clean-env', 'delay'];
const REPEATS = 2;
// Values that always differ between processes and say nothing about the launch.
const IGNORED_KEYS = new Set(['commandLine']);

const shellPath = () => process.env.PROBE_SHELL ?? execFileSync('where', ['pwsh'], { encoding: 'utf-8' }).split(/\r?\n/)[0].trim();

/** Starts the probe through `variant` and returns its JSON, or an error marker when it did not write one. */
async function probeThrough(variant, repeat, shell) {
  const out = path.join(RESULTS, `probe-${variant}-${repeat}.json`);
  const args = ['-NoProfile', '-NonInteractive', '-File', path.join(HERE, 'probe.ps1'), '-OutFile', out];
  const run = await installWithVariant(variant, shell, RESULTS, args);
  if (!fs.existsSync(out)) return { error: `no output (status ${run.statusHex}, ${run.error ?? 'no spawn error'})` };
  return JSON.parse(fs.readFileSync(out, 'utf-8').replace(/^﻿/, ''));
}

/** For each key, the distinct values and which variants have them (only keys that are not the same everywhere). */
function differences(byVariant) {
  const keys = new Set(Object.values(byVariant).flatMap((probe) => Object.keys(probe)));
  const report = {};
  for (const key of keys) {
    if (IGNORED_KEYS.has(key)) continue;
    const groups = {};
    for (const [variant, probe] of Object.entries(byVariant)) (groups[String(probe[key])] ??= []).push(variant);
    if (Object.keys(groups).length > 1) report[key] = groups;
  }
  return report;
}

fs.mkdirSync(RESULTS, { recursive: true });
const shell = shellPath();
const byVariant = {};
for (const variant of VARIANTS) {
  for (let repeat = 1; repeat <= REPEATS; repeat++) byVariant[`${variant}#${repeat}`] = await probeThrough(variant, repeat, shell);
}
const report = differences(byVariant);
fs.writeFileSync(path.join(RESULTS, 'differences.json'), JSON.stringify({ byVariant, report }, null, 2));
console.log(`probed with ${shell}`);
for (const [key, groups] of Object.entries(report)) console.log(`\n${key}:\n${Object.entries(groups).map(([value, who]) => `  ${value.slice(0, 160)}\n    <- ${who.join(', ')}`).join('\n')}`);
if (Object.keys(report).length === 0) console.log('no attribute differs between the launch paths');

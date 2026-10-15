// Root cause of the first-run 0xC0000005 of the NSIS installer on fresh runners (follow-up of
// investigations/2026-10-v120-installer, which ruled out Defender and left WER silent).
// Usage: node crash-root.mjs <plain|cdb|cdb-hd|procmon|medium> <attempt>   (INSTALLER_PUBLISHED_1_1_23 from get-installers.sh)
// plain:   install as the release test does, then record what the machine looked like and retry twice.
// cdb:     same install under the x86 debugger (round 1: 0 of 12 crashed, the debugger hides the crash).
// cdb-hd:  like cdb with the debug heap off (-hd), to tell a heap-layout bug from a timing one.
// procmon: plain install while Process Monitor records, keeping the installer's last events.
// default-dir: install with /S only (no /D) and report where the app landed: checks the install path the fix computes.
// reinstall: plain first install, repeated until it works, then 5 reinstalls: electron-builder's multiUser.nsh only calls
//           SHGetKnownFolderPath + `*$2(&w8192 .s)` (the over-read) when no InstallLocation is in the registry yet.
// medium:  the install in a Limited scheduled task via cmd.exe (it stayed High on the runner; it is a launch-path variant).
// stdio-ignore | clean-env | via-cmd | hide | detached | delay | async | cmd-nul | via-pwsh | cmd-start | pwsh-em0 (SetErrorMode(0) first, so WER keeps a dump): plain install with one part of Node's launch changed (see launch-variants.mjs).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { analyzeDumps, crashEvents, enableCrashDumps, hex, installSync, powershell, sleep, writeResult } from '../2026-10-v120-installer/lib.mjs';
import { startTrace, stopTrace } from './procmon.mjs';
import { installAtMediumIntegrity } from './medium.mjs';
import { LAUNCH_VARIANTS, installWithVariant } from './launch-variants.mjs';

const CDB = 'C:\\Program Files (x86)\\Windows Kits\\10\\Debuggers\\x86\\cdb.exe';
const MODES = ['plain', 'cdb', 'cdb-hd', 'procmon', 'medium', 'reinstall', 'default-dir', ...LAUNCH_VARIANTS];
const [mode, attempt] = process.argv.slice(2);
if (!MODES.includes(mode)) throw new Error(`Unknown mode "${mode}". Expected one of ${MODES.join(', ')}.`);

// INSTALLER_UNDER_TEST (a build of the fix or its control) wins over the published v1.1.23 from get-installers.sh.
const installer = process.env.INSTALLER_UNDER_TEST ?? process.env.INSTALLER_PUBLISHED_1_1_23;
if (!installer) throw new Error('Neither INSTALLER_UNDER_TEST nor INSTALLER_PUBLISHED_1_1_23 is set. Expected an installer path.');
const label = process.env.INSTALLER_LABEL ?? path.basename(installer);
const results = path.resolve('results');
const dumps = path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'dumps');
const installDir = (name) => path.join(os.tmpdir(), 'crash-root', name);

// The installer built from this repo is called "Emma's Librarian Setup ...exe": a quote inside a PowerShell '...' string must be doubled.
/** Machine facts at the moment of the first install: uptime, what else is busy, how the installer got here. */
function machineSnapshot() {
  const script =
    `$os = Get-CimInstance Win32_OperatingSystem; ` +
    `$busy = @(Get-Process | Sort-Object CPU -Descending | Select-Object -First 15 | ForEach-Object { $_.ProcessName }); ` +
    `$setup = @(Get-Process -Name msiexec,TiWorker,TrustedInstaller,wuauclt,MoUsoCoreWorker,setup* -ErrorAction SilentlyContinue | ForEach-Object { $_.ProcessName }); ` +
    `[pscustomobject]@{ uptimeSeconds=[int]((Get-Date) - $os.LastBootUpTime).TotalSeconds; freeMemoryMB=[int]($os.FreePhysicalMemory/1024); ` +
    `processCount=@(Get-Process).Count; busiest=$busy; setupLike=$setup; build=$os.BuildNumber; ` +
    `integrity=(whoami /groups | Select-String 'Mandatory Label').ToString().Trim(); ` +
    `zone=[bool](Get-Item -LiteralPath '${installer.replace(/'/g, "''")}' -Stream Zone.Identifier -ErrorAction SilentlyContinue) } | ConvertTo-Json -Compress; exit 0`;
  return JSON.parse(powershell(script));
}

/** Size, hash and PE machine of the installer (0x14c = 32-bit x86). */
function installerFacts() {
  const bytes = fs.readFileSync(installer);
  const peOffset = bytes.readUInt32LE(0x3c);
  return {
    file: path.basename(installer),
    bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16),
    peMachine: `0x${bytes.readUInt16LE(peOffset + 4).toString(16)}`,
  };
}

/** One install under cdb: logs first-chance and unhandled access violations with registers, stack and modules. */
function installUnderCdb(dir, label) {
  const log = path.join(results, `cdb-${label}.log`);
  const dump = path.join(results, `cdb-${label}.dmp`);
  const report = 'r; kb 40; lm; .lastevent';
  const commands = [
    `sxe -c ".echo ==FIRST-CHANCE-AV==; ${report}; g" -c2 ".echo ==SECOND-CHANCE-AV==; ${report}; !analyze -v; .dump /ma ${dump}; q" av`,
    'g',
    'q',
  ].join('; ');
  const started = Date.now();
  const heapFlag = mode === 'cdb-hd' ? ['-hd'] : [];
  const run = spawnSync(CDB, ['-logo', log, ...heapFlag, '-o', '-g', '-G', '-c', commands, installer, '/S', `/D=${dir}`], {
    encoding: 'utf-8',
    timeout: 300000,
  });
  return { status: run.status, statusHex: hex(run.status), ms: Date.now() - started, log: path.basename(log) };
}

/** What the crash left behind: leftover NSIS temp folders, crash events, minidumps. */
function aftermath(since) {
  fs.mkdirSync(results, { recursive: true });
  const kept = fs.existsSync(dumps) ? fs.readdirSync(dumps).filter((n) => n.endsWith('.dmp')) : [];
  kept.forEach((name) => fs.copyFileSync(path.join(dumps, name), path.join(results, name)));
  const analysis = kept.length > 0 ? analyzeDumps(dumps) : [];
  return { crashEvents: crashEvents(since), dumps: kept, analysis, nsisTemp: nsisTempContents() };
}

/** The ns*.tmp folders in %TEMP% with their files: shows which plugins the installer unpacked before it died. */
function nsisTempContents() {
  const script =
    `@(Get-ChildItem $env:TEMP -Filter 'ns*.tmp' -Directory | ForEach-Object { [pscustomobject]@{ folder=$_.Name; ` +
    `files=@(Get-ChildItem $_.FullName -Recurse -File | ForEach-Object { "$($_.Name):$($_.Length)" }) } }) | ConvertTo-Json -Depth 4 -Compress; exit 0`;
  const json = powershell(script).trim();
  return json ? [].concat(JSON.parse(json)) : [];
}

/** Per-user default location: %LOCALAPPDATA%/Programs/<folder>/Emma's Librarian.exe, whatever <folder> the build computes. */
function installIntoDefaultDirectory() {
  const started = Date.now();
  const result = spawnSync(installer, ['/S'], { timeout: 300000 });
  const programs = path.join(process.env.LOCALAPPDATA ?? '', 'Programs');
  const folders = fs.existsSync(programs) ? fs.readdirSync(programs) : [];
  const defaultFolders = folders.filter((name) => fs.existsSync(path.join(programs, name, "Emma's Librarian.exe")));
  return { status: result.status, statusHex: hex(result.status), ms: Date.now() - started, defaultFolders, programsListing: folders };
}

/** The plain install, optionally inside a Process Monitor capture that is kept only when the install crashed. */
async function installPlain(dir) {
  if (mode === 'default-dir') return { run: installIntoDefaultDirectory(), trace: null };
  if (mode === 'medium') return { run: await installAtMediumIntegrity(installer, dir), trace: null };
  if (LAUNCH_VARIANTS.includes(mode)) return { run: await installWithVariant(mode, installer, dir), trace: null };
  if (mode !== 'procmon') return { run: installSync(installer, dir), trace: null };
  const trace = await startTrace(path.join(results, 'trace.pml'));
  const run = installSync(installer, dir);
  const crashedNow = run.statusHex === '0xC0000005';
  const events = stopTrace(trace, path.basename(installer).slice(0, 15), crashedNow);
  if (!crashedNow) fs.rmSync(trace.pml, { force: true });
  return { run, trace: events };
}

/** Plain installs after the first: immediately, then 20 s later (what the release test does). */
async function retries(since) {
  const immediate = installSync(installer, installDir('retry-now'));
  await sleep(20000);
  const later = installSync(installer, installDir('retry-20s'));
  return { immediate, later, aftermath: aftermath(since) };
}

/** Statuses of the installs that follow the first: retries until one works (no registry key before that), then reinstalls. */
async function reinstallSeries(firstCrashed) {
  const dir = installDir('first');
  const recovery = [];
  while (firstCrashed && recovery.length < 6 && recovery.at(-1) !== '0x0') {
    await sleep(20000);
    recovery.push(installSync(installer, dir).statusHex);
  }
  const installed = !firstCrashed || recovery.at(-1) === '0x0';
  const reinstalls = installed ? Array.from({ length: 5 }, () => installSync(installer, dir).statusHex) : [];
  return { recovery, reinstalls };
}

fs.mkdirSync(results, { recursive: true });
enableCrashDumps(dumps);
const since = new Date();
const snapshot = machineSnapshot();
const facts = installerFacts();
const underCdb = mode.startsWith('cdb');
const { run: first, trace } = underCdb
  ? { run: installUnderCdb(installDir('first'), 'first'), trace: null }
  : await installPlain(installDir('first'));
console.log(`${mode} first install: ${first.statusHex} in ${first.ms} ms`);
const crashed = first.statusHex === '0xC0000005';
const afterFirst = aftermath(since);
const retried = crashed && !underCdb && mode === 'plain' ? await retries(since) : null;
const series = mode === 'reinstall' ? await reinstallSeries(crashed) : null;
writeResult(`crash-root-${mode}-${attempt}`, { label, mode, attempt: Number(attempt), snapshot, facts, first, crashed, afterFirst, retried, series, trace });

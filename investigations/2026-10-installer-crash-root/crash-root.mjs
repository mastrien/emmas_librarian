// Root cause of the first-run 0xC0000005 of the NSIS installer on fresh runners (follow-up of
// investigations/2026-10-v120-installer, which ruled out Defender and left WER silent).
// Usage: node crash-root.mjs <plain|cdb|cdb-hd|procmon|medium> <attempt>   (INSTALLER_PUBLISHED_1_1_23 from get-installers.sh)
// plain:   install as the release test does, then record what the machine looked like and retry twice.
// cdb:     same install under the x86 debugger (round 1: 0 of 12 crashed, the debugger hides the crash).
// cdb-hd:  like cdb with the debug heap off (-hd), to tell a heap-layout bug from a timing one.
// procmon: plain install while Process Monitor records, keeping the installer's last events.
// medium:  the install at Medium integrity (restricted token), as a normal non-elevated user would run it.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { crashEvents, enableCrashDumps, hex, installSync, powershell, sleep, writeResult } from '../2026-10-v120-installer/lib.mjs';
import { startTrace, stopTrace } from './procmon.mjs';
import { installAtMediumIntegrity } from './medium.mjs';

const CDB = 'C:\\Program Files (x86)\\Windows Kits\\10\\Debuggers\\x86\\cdb.exe';
const MODES = ['plain', 'cdb', 'cdb-hd', 'procmon', 'medium'];
const [mode, attempt] = process.argv.slice(2);
if (!MODES.includes(mode)) throw new Error(`Unknown mode "${mode}". Expected one of ${MODES.join(', ')}.`);

const installer = process.env.INSTALLER_PUBLISHED_1_1_23;
if (!installer) throw new Error('INSTALLER_PUBLISHED_1_1_23 is not set. Expected the path from get-installers.sh.');
const results = path.resolve('results');
const dumps = path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'dumps');
const installDir = (name) => path.join(os.tmpdir(), 'crash-root', name);

/** Machine facts at the moment of the first install: uptime, what else is busy, how the installer got here. */
function machineSnapshot() {
  const script =
    `$os = Get-CimInstance Win32_OperatingSystem; ` +
    `$busy = @(Get-Process | Sort-Object CPU -Descending | Select-Object -First 15 | ForEach-Object { $_.ProcessName }); ` +
    `$setup = @(Get-Process -Name msiexec,TiWorker,TrustedInstaller,wuauclt,MoUsoCoreWorker,setup* -ErrorAction SilentlyContinue | ForEach-Object { $_.ProcessName }); ` +
    `[pscustomobject]@{ uptimeSeconds=[int]((Get-Date) - $os.LastBootUpTime).TotalSeconds; freeMemoryMB=[int]($os.FreePhysicalMemory/1024); ` +
    `processCount=@(Get-Process).Count; busiest=$busy; setupLike=$setup; build=$os.BuildNumber; ` +
    `integrity=(whoami /groups | Select-String 'Mandatory Label').ToString().Trim(); ` +
    `zone=[bool](Get-Item -LiteralPath '${installer}' -Stream Zone.Identifier -ErrorAction SilentlyContinue) } | ConvertTo-Json -Compress; exit 0`;
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
  return { crashEvents: crashEvents(since), dumps: kept, nsisTemp: nsisTempContents() };
}

/** The ns*.tmp folders in %TEMP% with their files: shows which plugins the installer unpacked before it died. */
function nsisTempContents() {
  const script =
    `@(Get-ChildItem $env:TEMP -Filter 'ns*.tmp' -Directory | ForEach-Object { [pscustomobject]@{ folder=$_.Name; ` +
    `files=@(Get-ChildItem $_.FullName -Recurse -File | ForEach-Object { "$($_.Name):$($_.Length)" }) } }) | ConvertTo-Json -Depth 4 -Compress; exit 0`;
  const json = powershell(script).trim();
  return json ? [].concat(JSON.parse(json)) : [];
}

/** The plain install, optionally inside a Process Monitor capture that is kept only when the install crashed. */
async function installPlain(dir) {
  if (mode === 'medium') return { run: await installAtMediumIntegrity(installer, dir), trace: null };
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
writeResult(`crash-root-${mode}-${attempt}`, { mode, attempt: Number(attempt), snapshot, facts, first, crashed, afterFirst, retried, trace });

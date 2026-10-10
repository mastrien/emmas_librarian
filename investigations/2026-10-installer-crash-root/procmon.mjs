// Process Monitor around one install: a low-overhead trace (no debugger, so the crash is not hidden) of what the
// installer did right before it exited. Needs PROCMON_EXE (set by the workflow step that downloads it).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { sleep } from '../2026-10-v120-installer/lib.mjs';

const PROCMON = process.env.PROCMON_EXE;
const COLUMNS = ['time', 'process', 'pid', 'operation', 'path', 'result', 'detail'];

/** Starts the capture and waits until it is recording. Usage: const trace = await startTrace(pmlPath). */
export async function startTrace(pml) {
  if (!PROCMON) throw new Error('PROCMON_EXE is not set. Expected the path of Procmon.exe from the workflow step.');
  fs.rmSync(pml, { force: true });
  spawn(PROCMON, ['/AcceptEula', '/Quiet', '/Minimized', '/BackingFile', pml], { detached: true, stdio: 'ignore' }).unref();
  await sleep(6000);
  return { pml };
}

/** Stops the capture; only when `convert` is true (the install crashed) does it read the events, since a full 30 s install is huge. */
export function stopTrace({ pml }, processPrefix, convert, keep = 400) {
  spawnSync(PROCMON, ['/AcceptEula', '/Terminate'], { timeout: 60000 });
  if (!convert) return null;
  const csv = pml.replace(/\.pml$/, '.csv');
  spawnSync(PROCMON, ['/AcceptEula', '/OpenLog', pml, '/SaveAs', csv, '/Quiet'], { timeout: 300000 });
  if (!fs.existsSync(csv)) return { error: `no CSV from Procmon at ${csv}` };
  const rows = fs.readFileSync(csv, 'utf-8').split(/\r?\n/).slice(1).filter(Boolean).map(parseCsvRow);
  const mine = rows.filter((row) => row.process.startsWith(processPrefix));
  return { total: rows.length, installerEvents: mine.length, last: mine.slice(-keep) };
}

/** One CSV line of Procmon's default export; every field is quoted. */
function parseCsvRow(line) {
  const cells = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"'));
  return Object.fromEntries(COLUMNS.map((name, i) => [name, cells[i] ?? '']));
}

export const traceFiles = (dir) => fs.readdirSync(dir).filter((n) => /\.(pml|csv)$/.test(n)).map((n) => path.join(dir, n));

// TEMPORARY diagnostic for the intermittent AppImage launch hang in the Linux release test (PR #26): the app logs
// "App starting..." and nothing else, and Playwright never gets the DevTools endpoint.
// Opens and closes the AppImage `rounds` times in a row, either straight (spawn) or through Playwright, with
// Chromium logging on. On a hang it dumps the app's processes, kernel wait channels and a gdb backtrace of every
// thread, then kills it and goes on. Prints a summary line per round.
// Modes: pipe (stdout/stderr to a pipe, as Playwright and CI do), file (to a file, as a desktop launch),
// pipe-extract (pipe, but APPIMAGE_EXTRACT_AND_RUN=1: no FUSE mount), playwright. Add "verbose" for Chromium's
// own log (--enable-logging=stderr --v=1).
// Usage (under xvfb-run): node appimage-launch-loop.mjs <appimage> <rounds> <mode> <outDir> [verbose]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const [appImage, roundsArg, mode, outDir, verbose] = process.argv.slice(2);
const rounds = Number(roundsArg);
const MODES = ['pipe', 'file', 'pipe-extract', 'playwright'];
if (!appImage || !rounds || !MODES.includes(mode) || !outDir) {
  throw new Error(`Usage: appimage-launch-loop.mjs <appimage> <rounds> <${MODES.join('|')}> <outDir> [verbose]. Got ${process.argv.slice(2)}`);
}
fs.mkdirSync(outDir, { recursive: true });
const configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-diag-'));
const env = { ...process.env, XDG_CONFIG_HOME: configHome };
if (mode === 'pipe-extract') env.APPIMAGE_EXTRACT_AND_RUN = '1';
const chromiumArgs = verbose === 'verbose' ? ['--enable-logging=stderr', '--v=1'] : [];
const READY_MS = 40000;
const mainLog = path.join(configHome, 'emmas_librarian', 'logs', 'main.log');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sh = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf-8', timeout: 90000 });

const initializedCount = () =>
  fs.existsSync(mainLog) ? (fs.readFileSync(mainLog, 'utf-8').match(/App initialized/g) ?? []).length : 0;

function dumpHang(round, stderrText) {
  const file = path.join(outDir, `${mode}-round-${round}-hang.txt`);
  const ps = sh('ps', ['-eo', 'pid,ppid,stat,wchan:32,etime,args']).stdout;
  const appLines = ps.split('\n').filter((l) => /emmas|AppRun|\.mount_/i.test(l));
  const pids = sh('pgrep', ['-x', 'emmas-librarian']).stdout.trim().split('\n').filter(Boolean);
  // Kernel stacks and open pipes only, all pids first: gdb cannot attach to a process in uninterruptible sleep,
  // and while it waited (90 s) the other processes went away (A/B run 38023731036).
  const stacks = pids.map((pid) => {
    const kernel = sh('sudo', ['sh', '-c', `for t in /proc/${pid}/task/*; do echo "== $t $(cat $t/comm) $(cat $t/wchan)"; cat $t/stack; done`]);
    const fds = sh('sudo', ['sh', '-c', `ls -l /proc/${pid}/fd | grep -E 'pipe|fuse|socket' | head -40`]);
    return `##### kernel stacks ${pid}\n${kernel.stdout}\n##### fds ${pid}\n${fds.stdout}`;
  });
  const log = fs.existsSync(mainLog) ? fs.readFileSync(mainLog, 'utf-8') : '(no main.log)';
  fs.writeFileSync(
    file,
    [`### processes\n${appLines.join('\n')}`, `### main.log\n${log}`, `### stderr (tail)\n${stderrText.slice(-20000)}`, ...stacks].join('\n\n'),
  );
  console.log(`  hang dump: ${file}`);
}

function killApp() {
  sh('pkill', ['-KILL', '-x', 'emmas-librarian']);
}

async function plainRound(round) {
  const before = initializedCount();
  const outFile = path.join(outDir, `${mode}-round-${round}-output.txt`);
  const out = mode === 'file' ? fs.openSync(outFile, 'w') : 'pipe';
  const child = spawn(appImage, chromiumArgs, { env, stdio: ['ignore', out, out] });
  let stderrText = '';
  child.stdout?.on('data', (d) => (stderrText += d));
  child.stderr?.on('data', (d) => (stderrText += d));
  const started = Date.now();
  while (initializedCount() === before && Date.now() - started < READY_MS) await sleep(250);
  const readyMs = Date.now() - started;
  const ok = initializedCount() > before;
  if (!ok) dumpHang(round, stderrText);
  // Close as the release test does between launches: ask, then make sure.
  sh('pkill', ['-TERM', '-x', 'emmas-librarian']);
  const exited = await Promise.race([new Promise((r) => child.once('exit', () => r(true))), sleep(5000).then(() => false)]);
  if (!exited) killApp();
  if (typeof out === 'number') fs.closeSync(out);
  else if (!ok) fs.writeFileSync(outFile, stderrText);
  else fs.rmSync(outFile, { force: true });
  return { ok, readyMs, exited };
}

async function playwrightRound(round, electron) {
  const started = Date.now();
  try {
    const app = await electron.launch({ executablePath: appImage, args: chromiumArgs, env, timeout: READY_MS });
    const page = await app.firstWindow({ timeout: READY_MS });
    await page.waitForLoadState('domcontentloaded');
    const readyMs = Date.now() - started;
    await app.close();
    return { ok: true, readyMs, exited: true };
  } catch (err) {
    console.log(`  ${String(err.message).split('\n').slice(0, 3).join(' | ')}`);
    dumpHang(round, String(err.message));
    killApp();
    return { ok: false, readyMs: Date.now() - started, exited: false };
  }
}

const require = createRequire(path.join(process.cwd(), 'package.json'));
const electron = mode === 'playwright' ? require('playwright')._electron : null;
let hangs = 0;
for (let round = 1; round <= rounds; round++) {
  const result = mode === 'playwright' ? await playwrightRound(round, electron) : await plainRound(round);
  if (!result.ok) hangs++;
  console.log(`[${mode}] round ${round}: ${result.ok ? 'ready' : 'HANG'} in ${result.readyMs} ms, exited=${result.exited}`);
  // The release test relaunches about 3 s after closing.
  await sleep(1000);
}
console.log(`[${mode}] ${hangs} hang(s) in ${rounds} rounds`);
fs.rmSync(configHome, { recursive: true, force: true });

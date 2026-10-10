// Ways to start the installer from Node, to find which part of the launch matters for the first-run crash.
// Round 5: through cmd.exe the installer crashed 0 of 30 times, started straight from Node ~22% (28 of 134); stdio
// (pipes or ignored) made no difference and a minimal environment maybe some (2 of 30). Round 6 tests what cmd.exe adds:
//   hide     windowsHide: the child gets a hidden console (CREATE_NO_WINDOW)
//   detached the child gets no console at all (DETACHED_PROCESS) and its own process group
//   async    plain launch with the async spawn these variants use (the baseline `plain` is spawnSync): the control for them
//   delay    plain launch after a 100 ms pause (cmd.exe starts the installer a few ms later than Node would)
import { spawn } from 'node:child_process';
import { hex, sleep } from '../2026-10-v120-installer/lib.mjs';

const KEPT_ENV = [
  'SystemRoot', 'SystemDrive', 'windir', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ProgramFiles',
  'ProgramFiles(x86)', 'ProgramData', 'COMPUTERNAME', 'USERNAME', 'USERDOMAIN', 'ComSpec', 'PATHEXT', 'OS',
  'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS',
];
const DELAY_MS = 100;
const TIMEOUT_MS = 300000;

/** The environment of a bare interactive session: system variables only, none of the runner's GITHUB_* and tool paths. */
export function minimalEnvironment(env = process.env) {
  const kept = Object.fromEntries(KEPT_ENV.filter((name) => env[name] !== undefined).map((name) => [name, env[name]]));
  const root = env.SystemRoot ?? 'C:\\Windows';
  return { ...kept, PATH: `${root}\\system32;${root}` };
}

/** Per-variant spawn options, or a cmd.exe wrapper. */
function spawnPlan(variant, installer, args) {
  const direct = (options) => ({ file: installer, args, options });
  if (variant === 'stdio-ignore') return direct({ stdio: 'ignore' });
  if (variant === 'clean-env') return direct({ env: minimalEnvironment() });
  if (variant === 'hide') return direct({ windowsHide: true });
  if (variant === 'detached') return direct({ detached: true });
  if (variant === 'delay' || variant === 'async') return direct({});
  if (variant === 'via-cmd') {
    const line = `""${installer}" ${args.join(' ')}"`;
    return { file: 'cmd.exe', args: ['/d', '/s', '/c', line], options: { windowsVerbatimArguments: true } };
  }
  throw new Error(`Unknown launch variant "${variant}". Expected one of ${LAUNCH_VARIANTS.join(', ')}.`);
}

/** Starts the plan and waits for it; the pipes (when there are any) are drained so the installer never blocks on them. */
function runPlan(plan) {
  return new Promise((resolve) => {
    const child = spawn(plan.file, plan.args, plan.options);
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
    child.stdout?.resume();
    child.stderr?.resume();
    child.on('error', (error) => resolve({ status: null, error: error.message }));
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status });
    });
  });
}

/**
 * Installs once with the given launch variant and returns the exit status.
 * Usage: const run = await installWithVariant('hide', installerPath, installDir);
 */
export async function installWithVariant(variant, installer, dir) {
  const plan = spawnPlan(variant, installer, ['/S', `/D=${dir}`]);
  const started = Date.now();
  if (variant === 'delay') await sleep(DELAY_MS);
  const result = await runPlan(plan);
  return { status: result.status, statusHex: hex(result.status), ms: Date.now() - started, error: result.error, variant };
}

export const LAUNCH_VARIANTS = ['stdio-ignore', 'clean-env', 'via-cmd', 'hide', 'detached', 'delay', 'async'];

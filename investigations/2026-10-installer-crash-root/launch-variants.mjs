// Ways to start the installer from Node, to find which part of the launch matters for the first-run crash.
// Round 4 showed that an installer started by Task Scheduler through cmd.exe crashed 0 of 30 times while the same
// installer started by Node's spawnSync crashed ~22% (27 of 124), both at High integrity, so it is the launch, not the token.
import { spawnSync } from 'node:child_process';
import { hex } from '../2026-10-v120-installer/lib.mjs';

const KEPT_ENV = [
  'SystemRoot', 'SystemDrive', 'windir', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ProgramFiles',
  'ProgramFiles(x86)', 'ProgramData', 'COMPUTERNAME', 'USERNAME', 'USERDOMAIN', 'ComSpec', 'PATHEXT', 'OS',
  'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS',
];

/** The environment of a bare interactive session: system variables only, none of the runner's GITHUB_* and tool paths. */
export function minimalEnvironment(env = process.env) {
  const kept = Object.fromEntries(KEPT_ENV.filter((name) => env[name] !== undefined).map((name) => [name, env[name]]));
  const root = env.SystemRoot ?? 'C:\\Windows';
  return { ...kept, PATH: `${root}\\system32;${root}` };
}

/** Per-variant options of spawnSync (stdio, env) or a cmd.exe wrapper. */
function spawnPlan(variant, installer, args) {
  if (variant === 'stdio-ignore') return { file: installer, args, options: { stdio: 'ignore' } };
  if (variant === 'clean-env') return { file: installer, args, options: { env: minimalEnvironment() } };
  if (variant === 'via-cmd') {
    const line = `""${installer}" ${args.join(' ')}"`;
    return { file: 'cmd.exe', args: ['/d', '/s', '/c', line], options: { windowsVerbatimArguments: true } };
  }
  throw new Error(`Unknown launch variant "${variant}". Expected stdio-ignore, clean-env or via-cmd.`);
}

/**
 * Installs once with the given launch variant and returns the exit status.
 * Usage: const run = installWithVariant('clean-env', installerPath, installDir);
 */
export function installWithVariant(variant, installer, dir) {
  const plan = spawnPlan(variant, installer, ['/S', `/D=${dir}`]);
  const started = Date.now();
  const result = spawnSync(plan.file, plan.args, { timeout: 300000, ...plan.options });
  return { status: result.status, statusHex: hex(result.status), ms: Date.now() - started, error: result.error?.message, variant };
}

export const LAUNCH_VARIANTS = ['stdio-ignore', 'clean-env', 'via-cmd'];

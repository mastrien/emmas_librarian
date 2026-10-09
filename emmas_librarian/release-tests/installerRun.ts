// STATUS_ACCESS_VIOLATION. The published v1.1.23 installer exited with it on 3 of its first 5 runs on fresh
// GitHub runners (2026-10-08) without installing anything; the next run passed.
export const INSTALLER_CRASH = 0xc0000005;

export interface InstallerResult {
  status: number | null;
  signal: string | null;
  error?: Error;
  stdout?: string;
  stderr?: string;
}

export interface InstallerOutcome {
  /** The last run: the retry when there was one. */
  result: InstallerResult;
  /** The first run crashed with INSTALLER_CRASH, whether or not it was started again. */
  crashedFirst: boolean;
}

/**
 * Runs an installer once; when it crashes with INSTALLER_CRASH and the caller tolerates that, runs it one more
 * time. Only the installer of the published release (which this project does not control) may be tolerated:
 * the installer of the build under test crashing is a finding, not noise.
 *
 * `beforeRetry` runs only when the installer is started again (the update-flow test waits there: started
 * right away, its first installer crashed a second time).
 *
 * Usage:
 *   const { result, crashedFirst } = runInstallerOnce(() => spawnInstaller(oldExe), true);
 */
export function runInstallerOnce(
  run: () => InstallerResult,
  tolerateCrash: boolean,
  beforeRetry: () => void = () => undefined,
): InstallerOutcome {
  const first = run();
  const crashedFirst = first.status === INSTALLER_CRASH;
  if (!crashedFirst || !tolerateCrash) return { result: first, crashedFirst };
  beforeRetry();
  return { result: run(), crashedFirst };
}

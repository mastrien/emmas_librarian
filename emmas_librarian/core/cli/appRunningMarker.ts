import fs from 'fs';
import path from 'path';

const MARKER = 'app-running.json';

/** Tells whether a process id belongs to a live process; injected so tests need no real processes. */
export type ProcessProbe = (pid: number) => boolean;

/**
 * Whether a process with this id exists (signal 0 checks without touching it).
 *
 * Usage:
 *   isProcessAlive(process.pid); // true
 */
export const isProcessAlive: ProcessProbe = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const markerPath = (userData: string) => path.join(userData, MARKER);

/**
 * The desktop app leaves its process id in the library folder while it runs, so another shell (the
 * CLI) can tell the library is open before replacing its database.
 *
 * Usage:
 *   markAppRunning(paths.userData, process.pid);
 *   app.on('will-quit', () => clearAppRunning(paths.userData, process.pid));
 */
export function markAppRunning(userData: string, pid: number): void {
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(markerPath(userData), JSON.stringify({ pid }));
}

/** Removes the marker, unless another instance of the app has written its own since. */
export function clearAppRunning(userData: string, pid: number): void {
  if (readMarkedPid(userData) === pid) fs.rmSync(markerPath(userData), { force: true });
}

function readMarkedPid(userData: string): number | null {
  try {
    const { pid } = JSON.parse(fs.readFileSync(markerPath(userData), 'utf8')) as { pid?: unknown };
    return typeof pid === 'number' ? pid : null;
  } catch {
    return null;
  }
}

/**
 * Whether the desktop app is running on the library in `userData`. A marker left by a crash names a
 * process that no longer exists and counts as "not running".
 *
 * Usage:
 *   if (isAppRunningOn(paths.userData)) refuse();
 */
export function isAppRunningOn(userData: string, alive: ProcessProbe = isProcessAlive): boolean {
  const pid = readMarkedPid(userData);
  return pid !== null && alive(pid);
}

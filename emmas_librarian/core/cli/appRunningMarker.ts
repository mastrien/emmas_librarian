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

/** Where the running app answers the CLI of the same computer: a loopback port and its token. */
export interface LocalChannelAddress {
  port: number;
  token: string;
}

/**
 * The desktop app leaves its process id in the library folder while it runs, so another shell (the
 * CLI) can tell the library is open before replacing its database.
 *
 * With `channel`, it also says where the app answers the CLI. The file is owner-only: the token in it
 * lets a process of this user run commands on the library, which that user could do anyway.
 *
 * Usage:
 *   markAppRunning(paths.userData, process.pid, { port, token });
 *   app.on('will-quit', () => clearAppRunning(paths.userData, process.pid));
 */
export function markAppRunning(userData: string, pid: number, channel?: LocalChannelAddress): void {
  fs.mkdirSync(userData, { recursive: true });
  fs.rmSync(markerPath(userData), { force: true });
  fs.writeFileSync(markerPath(userData), JSON.stringify({ pid, ...channel }), { mode: 0o600 });
}

/** Removes the marker, unless another instance of the app has written its own since. */
export function clearAppRunning(userData: string, pid: number): void {
  if (readMarkedPid(userData) === pid) fs.rmSync(markerPath(userData), { force: true });
}

interface Marker {
  pid?: unknown;
  port?: unknown;
  token?: unknown;
}

function readMarker(userData: string): Marker {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(markerPath(userData), 'utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as Marker) : {};
  } catch {
    return {};
  }
}

function readMarkedPid(userData: string): number | null {
  const { pid } = readMarker(userData);
  return typeof pid === 'number' ? pid : null;
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

/**
 * Where the app running on this library answers the CLI, or null when it is not running (or runs a
 * version that opens no channel).
 *
 * Usage:
 *   const channel = localChannelOf(paths.userData);
 *   if (channel) forwardTo(channel); else openTheLibrary();
 */
export function localChannelOf(userData: string, alive: ProcessProbe = isProcessAlive): LocalChannelAddress | null {
  if (!isAppRunningOn(userData, alive)) return null;
  const { port, token } = readMarker(userData);
  return typeof port === 'number' && typeof token === 'string' ? { port, token } : null;
}

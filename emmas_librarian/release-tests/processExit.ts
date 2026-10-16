import { waitUntil } from './waitUntil';

/** Whether a process with this id exists (signal 0 only checks; it sends nothing). */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: it exists but belongs to someone else.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Waits until the process `pid` has exited. For the app quitting for its installer: Playwright's "close" event
 * also waits for every process still holding the app's stdout, and on Linux the AppImage runtime's FUSE helper
 * holds it while the mount stays busy, which the version the update started kept it (2026-10-10, PR #26:
 * 9.0.1 was up 2 s after "Reiniciar e Instalar" and "close" never came).
 *
 * Usage:
 *   await processExited(app.process().pid!, 120000, 'the app to quit for the installer');
 */
export async function processExited(pid: number, timeoutMs: number, what: string): Promise<void> {
  await waitUntil(() => !isProcessAlive(pid), timeoutMs, `${what} (pid ${pid})`, 250);
}

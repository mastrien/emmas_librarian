import { app } from 'electron';

/**
 * Restarts the app so it reopens a database that was just replaced on disk (backup restores).
 * E2E runs set E2E_SKIP_RELAUNCH=true: the app only exits, and the test relaunches it itself on the same
 * data folder — a self-relaunch would start an Electron window the test harness cannot control or close.
 *
 * Usage:
 *   overwriteDatabase(data);
 *   restartApp();
 */
export function restartApp(env: Record<string, string | undefined> = process.env): void {
  if (env.E2E_SKIP_RELAUNCH !== 'true') app.relaunch();
  app.exit(0);
}

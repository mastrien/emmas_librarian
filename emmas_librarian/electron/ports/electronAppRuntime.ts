import { app } from 'electron';
import type { AppRuntime } from '../../core/ports/AppRuntime';
import { restartApp } from '../restartApp';

/**
 * AppRuntime of the desktop app: Electron's version and a relaunch.
 *
 * Usage:
 *   const sync = new SyncService(db, paths, electronAppRuntime());
 */
export function electronAppRuntime(restart: () => void = restartApp): AppRuntime {
  return { version: app.getVersion(), restart };
}

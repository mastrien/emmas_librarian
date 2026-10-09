import { EventEmitter } from 'events';
import type { IAppUpdater } from './UpdateTypes';

/**
 * Fallback no-op updater used when no native AppUpdater is injected.
 *
 * Usage:
 *   const updater = deps?.updater || new NoopAppUpdater();
 */
export class NoopAppUpdater extends EventEmitter implements IAppUpdater {
  public autoDownload = false;
  public autoInstallOnAppQuit = false;
  public logger: unknown = null;

  public async checkForUpdates(): Promise<unknown> {
    return null;
  }

  public async downloadUpdate(): Promise<unknown> {
    return null;
  }

  public quitAndInstall(): void {
    // no-op
  }
}

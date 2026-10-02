import { EventEmitter } from 'events';
import type { IAppUpdater } from '../../UpdateTypes';

/**
 * Fake implementation of electron-updater's AppUpdater for unit testing.
 *
 * Usage:
 *   const fakeUpdater = new FakeAppUpdater();
 *   const manager = new UpdateManager(fakeUpdater, safetyService);
 */
export class FakeAppUpdater extends EventEmitter implements IAppUpdater {
  public autoDownload = true;
  public autoInstallOnAppQuit = true;
  public logger: unknown = null;
  public checkForUpdatesCalled = false;
  public downloadUpdateCalled = false;
  public quitAndInstallCalled = false;
  public lastQuitAndInstallArgs: { isSilent?: boolean; isForceRunAfter?: boolean } | null = null;

  public async checkForUpdates(): Promise<unknown> {
    this.checkForUpdatesCalled = true;
    return null;
  }

  public async downloadUpdate(): Promise<unknown> {
    this.downloadUpdateCalled = true;
    return null;
  }

  public quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void {
    this.quitAndInstallCalled = true;
    this.lastQuitAndInstallArgs = { isSilent, isForceRunAfter };
  }
}

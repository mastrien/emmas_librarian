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
  /** Set to make the next check / download reject, as electron-updater does when offline. */
  public checkFailure: Error | null = null;
  public downloadFailure: Error | null = null;

  public async checkForUpdates(): Promise<unknown> {
    this.checkForUpdatesCalled = true;
    if (this.checkFailure) throw this.checkFailure;
    return null;
  }

  public async downloadUpdate(): Promise<unknown> {
    this.downloadUpdateCalled = true;
    if (this.downloadFailure) throw this.downloadFailure;
    return null;
  }

  public quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void {
    this.quitAndInstallCalled = true;
    this.lastQuitAndInstallArgs = { isSilent, isForceRunAfter };
  }
}

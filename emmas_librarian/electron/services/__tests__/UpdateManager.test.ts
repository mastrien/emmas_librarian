import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateManager } from '../UpdateManager';
import { FakeAppUpdater } from './fakes/FakeAppUpdater';
import type { UpdateSafetyService } from '../UpdateSafetyService';
import type { SnapshotCreationResult, UpdateStateRecord } from '../UpdateTypes';

class FakeUpdateSafetyService implements Partial<UpdateSafetyService> {
  public snapshotCalledWith: { from: string; target: string } | null = null;
  public state: UpdateStateRecord | null = null;

  public createPreUpdateSnapshot(fromVersion: string, targetVersion: string): SnapshotCreationResult {
    this.snapshotCalledWith = { from: fromVersion, target: targetVersion };
    return {
      snapshotPath: '/path/pre_update.db.gz',
      fromVersion,
      targetVersion,
      timestamp: Date.now(),
    };
  }

  public getUpdateState(): UpdateStateRecord | null {
    return this.state;
  }
}

describe('UpdateManager', () => {
  let fakeUpdater: FakeAppUpdater;
  let fakeSafety: FakeUpdateSafetyService;
  let manager: UpdateManager;

  beforeEach(() => {
    fakeUpdater = new FakeAppUpdater();
    fakeSafety = new FakeUpdateSafetyService();
    manager = new UpdateManager(fakeUpdater, fakeSafety as UpdateSafetyService);
  });

  it('disables autoDownload and autoInstallOnAppQuit on init', () => {
    expect(fakeUpdater.autoDownload).toBe(false);
    expect(fakeUpdater.autoInstallOnAppQuit).toBe(false);
    expect(manager.getStatus().status).toBe('idle');
  });

  it('handles update-available lifecycle and listener notifications', async () => {
    const statuses: string[] = [];
    manager.addStatusListener((s) => statuses.push(s.status));

    const checkPromise = manager.checkForUpdates();
    expect(fakeUpdater.checkForUpdatesCalled).toBe(true);
    expect(statuses).toContain('checking');

    fakeUpdater.emit('update-available', {
      version: '1.3.0',
      releaseDate: '2026-10-02',
      releaseNotes: 'Performance improvements',
    });

    await checkPromise;

    const current = manager.getStatus();
    expect(current.status).toBe('available');
    expect(current.updateInfo?.version).toBe('1.3.0');
    expect(current.updateInfo?.releaseNotes).toBe('Performance improvements');
    expect(statuses).toContain('available');
  });

  it('tracks download progress and transitions to downloaded', async () => {
    fakeUpdater.emit('update-available', { version: '1.3.0' });

    let receivedProgress: number | null = null;
    manager.addProgressListener((p) => {
      receivedProgress = p.percent;
    });

    const downloadPromise = manager.downloadUpdate();
    expect(fakeUpdater.downloadUpdateCalled).toBe(true);

    fakeUpdater.emit('download-progress', {
      percent: 45.5,
      bytesPerSecond: 1024,
      transferred: 450,
      total: 1000,
    });

    expect(receivedProgress).toBe(45.5);
    expect(manager.getStatus().downloadProgress?.percent).toBe(45.5);

    fakeUpdater.emit('update-downloaded', { version: '1.3.0' });
    await downloadPromise;

    expect(manager.getStatus().status).toBe('downloaded');
  });

  it('fails downloadUpdate if update is not in available state', async () => {
    await expect(manager.downloadUpdate()).rejects.toThrowError(/ERR_UPDATE_NOT_AVAILABLE/);
  });

  it('creates pre-update snapshot before triggering quitAndInstall', async () => {
    fakeUpdater.emit('update-available', { version: '1.3.0' });
    fakeUpdater.emit('update-downloaded', { version: '1.3.0' });

    await manager.prepareAndInstall('1.2.0');

    expect(fakeSafety.snapshotCalledWith).toEqual({ from: '1.2.0', target: '1.3.0' });
    expect(fakeUpdater.quitAndInstallCalled).toBe(true);
    expect(fakeUpdater.lastQuitAndInstallArgs).toEqual({ isSilent: false, isForceRunAfter: true });
  });

  it('fails prepareAndInstall if update is not downloaded', async () => {
    await expect(manager.prepareAndInstall('1.2.0')).rejects.toThrowError(/ERR_UPDATE_NOT_DOWNLOADED/);
  });

  it('reports that no update is available', () => {
    fakeUpdater.emit('update-not-available');

    expect(manager.getStatus().status).toBe('not-available');
  });

  it('records the updater error message', () => {
    fakeUpdater.emit('error', new Error('net::ERR_INTERNET_DISCONNECTED'));

    expect(manager.getStatus()).toMatchObject({ status: 'error', error: 'net::ERR_INTERNET_DISCONNECTED' });
  });

  it('answers null and records the error when the check fails', async () => {
    fakeUpdater.checkFailure = new Error('getaddrinfo ENOTFOUND github.com');

    const info = await manager.checkForUpdates();

    expect(info).toBeNull();
    expect(manager.getStatus()).toMatchObject({ status: 'error', error: 'getaddrinfo ENOTFOUND github.com' });
  });

  it('records and rethrows a failed download', async () => {
    fakeUpdater.emit('update-available', { version: '1.3.0' });
    fakeUpdater.downloadFailure = new Error('ECONNRESET');

    await expect(manager.downloadUpdate()).rejects.toThrow('ECONNRESET');
    expect(manager.getStatus()).toMatchObject({ status: 'error', error: 'ECONNRESET' });
  });

  it('takes the version from the download when no availability event came first', () => {
    fakeUpdater.emit('update-downloaded', { version: '1.3.1', releaseDate: '2026-10-03' });

    expect(manager.getStatus()).toMatchObject({
      status: 'downloaded',
      updateInfo: { version: '1.3.1', releaseDate: '2026-10-03' },
    });
  });
});

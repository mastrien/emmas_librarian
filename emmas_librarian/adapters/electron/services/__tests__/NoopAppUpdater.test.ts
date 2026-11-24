import { describe, it, expect } from 'vitest';
import { NoopAppUpdater } from '../NoopAppUpdater';

describe('NoopAppUpdater', () => {
  it('starts with automatic download and install off', () => {
    const updater = new NoopAppUpdater();

    expect(updater.autoDownload).toBe(false);
    expect(updater.autoInstallOnAppQuit).toBe(false);
  });

  it('finds and downloads nothing, and installing does nothing', async () => {
    const updater = new NoopAppUpdater();

    await expect(updater.checkForUpdates()).resolves.toBeNull();
    await expect(updater.downloadUpdate()).resolves.toBeNull();
    expect(() => updater.quitAndInstall()).not.toThrow();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupIpcRegistries } from '../ipcRegistries';
import { IpcChannel } from '../../../src/types';
import { resetIpcHarness, invoke, harness } from './fakes/ipcHarness';
import { FakeAppUpdater } from '../../services/__tests__/fakes/FakeAppUpdater';
import { UpdateSafetyService } from '../../services/UpdateSafetyService';
import { UpdateManager } from '../../services/UpdateManager';
import type { SnapshotRestoreResult } from '../../services/UpdateTypes';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';

vi.mock('electron', () => import('./fakes/ipcHarness').then((h) => h.electronModule));
vi.mock('fs', () => import('./fakes/ipcHarness').then((h) => h.fsModule));
vi.mock('../../database/DatabaseAdapter', () => import('./fakes/ipcHarness').then((h) => h.databaseAdapterModule));
vi.mock('../../database/ScientificVenueRepository', () =>
  import('./fakes/ipcHarness').then((h) => h.venueRepositoryModule),
);
vi.mock('../../database/SyncService', () => import('./fakes/ipcHarness').then((h) => h.syncServiceModule));
vi.mock('../../services/SearchOrchestrator', () =>
  import('./fakes/ipcHarness').then((h) => h.searchOrchestratorModule),
);
vi.mock('../../services/QueryTranslator', () => import('./fakes/ipcHarness').then((h) => h.queryTranslatorModule));
vi.mock('../../services/ApiIntegrator', () => import('./fakes/ipcHarness').then((h) => h.apiIntegratorModule));
vi.mock('../../services/ExportService', () => import('./fakes/ipcHarness').then((h) => h.exportServiceModule));
vi.mock('../../services/AIService', () => import('./fakes/ipcHarness').then((h) => h.aiServiceModule));
vi.mock('../../services/BackupService', () => import('./fakes/ipcHarness').then((h) => h.backupServiceModule));

class MockSafetyService implements Partial<UpdateSafetyService> {
  public restoreArgs: unknown[][] = [];

  public getUpdateState() {
    return null;
  }

  public restorePreUpdateSnapshot(...args: unknown[]): SnapshotRestoreResult {
    this.restoreArgs.push(args);
    return { restoredFrom: 'pre_update.db.gz', preRestoreBackupPath: 'pre_restore.db.gz' };
  }
}

class RestartRecorder {
  public restarts = 0;
  public readonly restart = () => {
    this.restarts += 1;
  };
}

describe('Update IPC handlers', () => {
  let fakeUpdater: FakeAppUpdater;
  let mockSafety: MockSafetyService;
  let updateManager: UpdateManager;
  let restarter: RestartRecorder;

  beforeEach(() => {
    resetIpcHarness();
    fakeUpdater = new FakeAppUpdater();
    mockSafety = new MockSafetyService();
    restarter = new RestartRecorder();
    updateManager = new UpdateManager(fakeUpdater, mockSafety as unknown as UpdateSafetyService);

    setupIpcRegistries({
      updateManager,
      safetyService: mockSafety as unknown as UpdateSafetyService,
      restartApp: restarter.restart,
    });
  });

  it('delegates UPDATE_GET_STATUS to updateManager', async () => {
    const status = (await invoke(IpcChannel.UPDATE_GET_STATUS)) as { status: string };
    expect(status.status).toBe('idle');
  });

  it('delegates UPDATE_CHECK to updateManager', async () => {
    await invoke(IpcChannel.UPDATE_CHECK);
    expect(fakeUpdater.checkForUpdatesCalled).toBe(true);
  });

  it('restores the recorded snapshot, ignoring any path sent by the renderer, then restarts', async () => {
    const res = await invoke(IpcChannel.UPDATE_RESTORE_SNAPSHOT, 'C:/somewhere/else.db.gz');

    expect(res).toEqual({ restoredFrom: 'pre_update.db.gz', preRestoreBackupPath: 'pre_restore.db.gz' });
    expect(mockSafety.restoreArgs).toEqual([[]]);
    expect(restarter.restarts).toBe(1);
  });

  describe('events sent to the windows', () => {
    class FakeWindow {
      public sent: [string, unknown][] = [];
      constructor(private readonly destroyed = false) {}
      public isDestroyed = () => this.destroyed;
      public webContents = { send: (channel: string, payload: unknown) => this.sent.push([channel, payload]) };
    }

    it('sends status changes to every open window and skips destroyed ones', () => {
      const open = new FakeWindow();
      const closed = new FakeWindow(true);
      harness.windows.getAllWindows.mockReturnValue([open, closed]);

      fakeUpdater.emit('update-available', { version: '1.3.0' });

      expect(open.sent).toEqual([
        ['update:status-changed', expect.objectContaining({ status: 'available', updateInfo: { version: '1.3.0' } })],
      ]);
      expect(closed.sent).toEqual([]);
    });

    it('sends download progress', () => {
      const open = new FakeWindow();
      harness.windows.getAllWindows.mockReturnValue([open]);

      fakeUpdater.emit('download-progress', { percent: 42, bytesPerSecond: 10, transferred: 42, total: 100 });

      expect(open.sent[0]).toEqual([
        'update:download-progress',
        { percent: 42, bytesPerSecond: 10, transferred: 42, total: 100 },
      ]);
    });
  });
});

class UpdaterThatCannotStart extends FakeAppUpdater {
  public on(): never {
    throw new Error('electron-updater failed to initialise');
  }
}

describe('setupIpcRegistries when the startup fails after the library opened', () => {
  beforeEach(() => resetIpcHarness());

  it('closes the library it opened, so the recovery can replace the file', () => {
    expect(() => setupIpcRegistries({ updater: new UpdaterThatCannotStart() })).toThrowError(/failed to initialise/);

    expect(harness.db.close).toHaveBeenCalledTimes(1);
  });

  it('leaves a library it was given to its owner', () => {
    const given = harness.db as unknown as DatabaseAdapter;

    expect(() => setupIpcRegistries({ db: given, updater: new UpdaterThatCannotStart() })).toThrowError();

    expect(harness.db.close).not.toHaveBeenCalled();
  });

  it('still reports the startup error when closing the library fails too', () => {
    harness.db.close.mockImplementation(() => {
      throw new Error('already closed');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => setupIpcRegistries({ updater: new UpdaterThatCannotStart() })).toThrowError(/failed to initialise/);
  });
});

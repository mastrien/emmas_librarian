import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupIpcRegistries } from '../ipcRegistries';
import { IpcChannel } from '../../../src/types';
import { resetIpcHarness, invoke } from './fakes/ipcHarness';
import { FakeAppUpdater } from '../../services/__tests__/fakes/FakeAppUpdater';
import { UpdateSafetyService } from '../../services/UpdateSafetyService';
import { UpdateManager } from '../../services/UpdateManager';
import type { SnapshotRestoreResult } from '../../services/UpdateTypes';

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
});

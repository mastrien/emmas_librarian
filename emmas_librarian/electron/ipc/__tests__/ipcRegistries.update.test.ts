import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupIpcRegistries } from '../ipcRegistries';
import { IpcChannel } from '../../../src/types';
import { resetIpcHarness, invoke } from './fakes/ipcHarness';
import { FakeAppUpdater } from '../../services/__tests__/fakes/FakeAppUpdater';
import { UpdateSafetyService } from '../../services/UpdateSafetyService';
import { UpdateManager } from '../../services/UpdateManager';

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
  public restoreCalled = false;
  public restorePathArg: string | undefined = undefined;

  public getUpdateState() {
    return null;
  }

  public restorePreUpdateSnapshot(explicitPath?: string): boolean {
    this.restoreCalled = true;
    this.restorePathArg = explicitPath;
    return true;
  }
}

describe('Update IPC handlers', () => {
  let fakeUpdater: FakeAppUpdater;
  let mockSafety: MockSafetyService;
  let updateManager: UpdateManager;

  beforeEach(() => {
    resetIpcHarness();
    fakeUpdater = new FakeAppUpdater();
    mockSafety = new MockSafetyService();
    updateManager = new UpdateManager(fakeUpdater, mockSafety as unknown as UpdateSafetyService);

    setupIpcRegistries({
      updateManager,
      safetyService: mockSafety as unknown as UpdateSafetyService,
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

  it('delegates UPDATE_RESTORE_SNAPSHOT to safetyService', async () => {
    const res = await invoke(IpcChannel.UPDATE_RESTORE_SNAPSHOT, 'custom/snapshot.db.gz');
    expect(res).toBe(true);
    expect(mockSafety.restoreCalled).toBe(true);
    expect(mockSafety.restorePathArg).toBe('custom/snapshot.db.gz');
  });
});

import path from 'path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupIpcRegistries } from '../ipcRegistries';
import { resetIpcHarness, aiServiceConstructions, USER_DATA } from './fakes/ipcHarness';

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

describe('setupIpcRegistries: AI service wiring', () => {
  beforeEach(() => {
    resetIpcHarness();
    setupIpcRegistries();
  });

  // Regression: the packaged app cached the local embedding model inside app.asar (read-only), so it was
  // downloaded again on every launch. The cache must live in userData/models.
  it('gives the AI service userData/models as the local embedding model cache', () => {
    expect(aiServiceConstructions).toHaveLength(1);
    expect(aiServiceConstructions[0][1]).toBe(path.join(USER_DATA, 'models'));
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import { setupIpcRegistries } from '../ipcRegistries';
import { IpcChannel } from '../../types';
import { harness, resetIpcHarness, invoke, rejectionPayload } from './fakes/ipcHarness';
import { CATEGORY_TEMPLATES, categorySetJson } from '../../../src/utils/categoryTemplates';

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

const { db, disk, dialog } = harness;
const SET_FILE = path.join(path.sep, 'sets', 'categorias.json');
const pico = CATEGORY_TEMPLATES[0].categories;

beforeEach(() => {
  resetIpcHarness();
  setupIpcRegistries();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('CATEGORIES_APPLY_SET (#46)', () => {
  it('hands a valid set to the database and answers what was created', async () => {
    db.applyCategorySet.mockReturnValue({ created: ['População'], skipped: [] });

    expect(await invoke(IpcChannel.CATEGORIES_APPLY_SET, 4, pico)).toEqual({ created: ['População'], skipped: [] });
    expect(db.applyCategorySet).toHaveBeenCalledWith(4, pico);
  });

  it('refuses a malformed set before it reaches the database', async () => {
    const payload = await rejectionPayload(invoke(IpcChannel.CATEGORIES_APPLY_SET, 4, [{ name: 'X', type: 'date' }]));

    expect(payload.message).toMatch(/ERR_INVALID_CATEGORY_SET.*"date"/);
    expect(db.applyCategorySet).not.toHaveBeenCalled();
  });
});

describe('CATEGORIES_READ_SET_FILE (#46)', () => {
  const projectCategories = pico.map((c, i) => ({ id: i + 1, project_id: 1, ...c }));

  it('reads and checks the JSON file the person picked', async () => {
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [SET_FILE] });
    disk.writeFileSync(SET_FILE, categorySetJson(projectCategories));

    expect(await invoke(IpcChannel.CATEGORIES_READ_SET_FILE)).toEqual(pico);
    expect(dialog.showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({ filters: [{ name: 'Conjunto de categorias (JSON)', extensions: ['json'] }] }),
    );
  });

  it('answers null when the dialog is cancelled', async () => {
    dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

    expect(await invoke(IpcChannel.CATEGORIES_READ_SET_FILE)).toBeNull();
  });

  it('uses the E2E file without a dialog, and rejects a file that is not a category set', async () => {
    vi.stubEnv('E2E_MOCK_OPEN_FILE', SET_FILE);
    disk.writeFileSync(SET_FILE, '{"kind":"zotero"}');

    expect((await rejectionPayload(invoke(IpcChannel.CATEGORIES_READ_SET_FILE))).message).toMatch(
      /ERR_INVALID_CATEGORY_SET.*"zotero"/,
    );
    expect(dialog.showOpenDialog).not.toHaveBeenCalled();
  });
});

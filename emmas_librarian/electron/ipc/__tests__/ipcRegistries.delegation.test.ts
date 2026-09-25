import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupIpcRegistries } from '../ipcRegistries';
import { IpcChannel } from '../../types';
import { IpcChannel as RendererIpcChannel } from '../../../src/types';
import { harness, resetIpcHarness, invoke } from './fakes/ipcHarness';
import type { RecordingDouble } from './fakes/RecordingDouble';

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

type Outcome = 'passthrough' | 'void' | 'true';

interface DelegationCase {
  channel: IpcChannel;
  args: unknown[];
  target: () => RecordingDouble;
  method: string;
  forwarded: unknown[];
  outcome: Outcome;
}

const db = () => harness.db;
const venue = { name: 'Conf', deadlines: [] };

function viaDb(channel: IpcChannel, method: string, args: unknown[], outcome: Outcome = 'passthrough'): DelegationCase {
  return { channel, args, target: db, method, forwarded: args, outcome };
}

const cases: DelegationCase[] = [
  viaDb(IpcChannel.PROJECTS_GET_ALL, 'getAllProjects', []),
  viaDb(IpcChannel.PROJECTS_GET_ONE, 'getProject', [1]),
  viaDb(IpcChannel.PROJECTS_GET_WRITING_PAD, 'getProjectWritingPad', [1]),
  viaDb(IpcChannel.PROJECTS_UPDATE_WRITING_PAD, 'updateProjectWritingPad', [1, 'pad']),
  viaDb(IpcChannel.PROJECTS_GET_SEARCH_HISTORY, 'getSearchHistory', [1]),
  viaDb(IpcChannel.PROJECTS_UPDATE, 'updateProject', [1, 'Novo']),
  viaDb(IpcChannel.PROJECTS_DELETE, 'deleteProject', [1]),
  viaDb(IpcChannel.SEARCH_REVERT, 'revertSearch', [9]),
  viaDb(IpcChannel.ARTICLES_GET_BY_PROJECT, 'getArticlesByProject', [1]),
  viaDb(IpcChannel.ARTICLES_GET_ONE, 'getArticle', [2]),
  viaDb(IpcChannel.ARTICLES_UPDATE_STATUS, 'updateArticleStatus', [2, 'read', 'nota']),
  viaDb(IpcChannel.ARTICLES_UPDATE_METADATA, 'updateArticleMetadata', [2, { title: 'T' }]),
  viaDb(IpcChannel.SETTINGS_GET, 'getSetting', ['theme']),
  viaDb(IpcChannel.SETTINGS_SET, 'setSetting', ['theme', 'dark']),
  viaDb(IpcChannel.ANNOTATIONS_GET, 'getAnnotations', [2]),
  viaDb(IpcChannel.ANNOTATIONS_CREATE, 'saveAnnotation', [2, 'c']),
  viaDb(IpcChannel.ANNOTATIONS_UPDATE, 'updateAnnotation', [3, 'c']),
  viaDb(IpcChannel.ANNOTATIONS_DELETE, 'deleteAnnotation', [3]),
  viaDb(IpcChannel.HIGHLIGHTS_GET, 'getHighlights', [2]),
  viaDb(IpcChannel.HIGHLIGHTS_DELETE, 'deleteHighlight', [4]),
  viaDb(IpcChannel.PDF_LIBRARY_LIST, 'getStoredPdfs', []),
  viaDb(IpcChannel.PDF_LIBRARY_LINK, 'linkPdfToArticle', [2, '/lib/a.pdf'], 'void'),
  viaDb(IpcChannel.DIARY_GET_ALL, 'getDiaryEntries', [1]),
  viaDb(IpcChannel.DIARY_GET_ONE, 'getDiaryEntry', [1, '2026-01-01']),
  viaDb(IpcChannel.DIARY_SAVE, 'saveDiaryEntry', [1, '2026-01-01', 'texto']),
  viaDb(IpcChannel.DIARY_DELETE, 'deleteDiaryEntry', [1, '2026-01-01']),
  viaDb(IpcChannel.DIARY_GET_HISTORY, 'getDiaryEntryHistory', [1, '2026-01-01']),
  viaDb(IpcChannel.DIARY_RESTORE_VERSION, 'restoreDiaryEntryVersion', [7]),
  viaDb(IpcChannel.PENDING_HIGHLIGHTS_GET, 'getPendingHighlights', [2]),
  viaDb(IpcChannel.PENDING_HIGHLIGHTS_DELETE, 'deletePendingHighlight', [8]),
  viaDb(IpcChannel.PROJECT_DOCUMENTS_GET, 'getProjectDocuments', [1]),
  viaDb(IpcChannel.PROJECT_DOCUMENTS_REORDER, 'reorderProjectDocuments', [1, [3, 2]]),
  viaDb(IpcChannel.PROJECT_DOCUMENTS_DELETE, 'deleteProjectDocument', [3]),
  viaDb(IpcChannel.MASSIVE_INVESTIGATIONS_GET, 'getMassiveInvestigations', [1]),
  viaDb(IpcChannel.MASSIVE_INVESTIGATIONS_SAVE, 'saveMassiveInvestigation', [1, ['q'], [2], 'model', 'done']),
  viaDb(IpcChannel.CATEGORIES_GET_PROJECT, 'getProjectCategories', [1]),
  viaDb(IpcChannel.CATEGORIES_CREATE_PROJECT, 'createProjectCategory', [1, 'Cat', 'select', { options: ['a'] }]),
  viaDb(IpcChannel.CATEGORIES_UPDATE_PROJECT, 'updateProjectCategory', [5, 'Cat', 'text', null], 'true'),
  viaDb(IpcChannel.CATEGORIES_DELETE_PROJECT, 'deleteProjectCategory', [5], 'true'),
  viaDb(IpcChannel.CATEGORIES_GET_ARTICLE, 'getArticleCategories', [2]),
  viaDb(IpcChannel.CATEGORIES_SET_ARTICLE, 'setArticleCategory', [2, 5, 'v'], 'true'),
  viaDb(IpcChannel.CATEGORIES_GET_ALL_PROJECT_ARTICLE, 'getAllProjectArticleCategories', [1]),
  viaDb(IpcChannel.TRASH_GET_ITEMS, 'getTrashItems', []),
  viaDb(IpcChannel.TRASH_RESTORE_ITEM, 'restoreTrashItem', ['article', 2]),
  viaDb(IpcChannel.TRASH_PERMANENT_DELETE, 'deleteTrashItemPermanent', ['project', 1]),
  viaDb(IpcChannel.TRASH_EMPTY, 'emptyTrash', []),
  {
    channel: IpcChannel.SEARCH_EXECUTE,
    args: [1, { openalex: 'q' }, 50, 'date', 'uq'],
    target: () => harness.orchestrator,
    method: 'searchAndPersist',
    forwarded: [1, { openalex: 'q' }, 50, 'date', 'uq'],
    outcome: 'passthrough',
  },
  {
    channel: IpcChannel.SEARCH_TRANSLATE_QUERY,
    args: [{ type: 'term' }],
    target: () => harness.translator,
    method: 'translate',
    forwarded: [{ type: 'term' }],
    outcome: 'passthrough',
  },
  {
    channel: IpcChannel.SYNC_EXPORT_PROJECT,
    args: [1],
    target: () => harness.sync,
    method: 'exportProject',
    forwarded: [1],
    outcome: 'passthrough',
  },
  {
    channel: IpcChannel.SYNC_IMPORT_PROJECT,
    args: ['/p.zip'],
    target: () => harness.sync,
    method: 'importProject',
    forwarded: ['/p.zip'],
    outcome: 'passthrough',
  },
  {
    channel: IpcChannel.BACKUP_EXPORT,
    args: [],
    target: () => harness.sync,
    method: 'exportBackup',
    forwarded: [],
    outcome: 'passthrough',
  },
  {
    channel: IpcChannel.BACKUP_RESTORE_OVERRIDE,
    args: [],
    target: () => harness.sync,
    method: 'restoreBackupOverride',
    forwarded: [],
    outcome: 'passthrough',
  },
  {
    channel: IpcChannel.BACKUP_RESTORE_MERGE,
    args: [],
    target: () => harness.sync,
    method: 'restoreBackupMerge',
    forwarded: [],
    outcome: 'passthrough',
  },
  {
    channel: IpcChannel.BACKUP_LIST_AUTO,
    args: [],
    target: () => harness.backup,
    method: 'listAutoBackups',
    forwarded: [],
    outcome: 'passthrough',
  },
  {
    channel: IpcChannel.BACKUP_RESTORE_AUTO,
    args: ['auto.zip'],
    target: () => harness.backup,
    method: 'restoreAutoBackup',
    forwarded: ['auto.zip'],
    outcome: 'passthrough',
  },
  {
    channel: IpcChannel.SCIENTIFIC_VENUES_GET_ALL,
    args: [],
    target: () => harness.venues,
    method: 'getAllVenues',
    forwarded: [],
    outcome: 'passthrough',
  },
  {
    channel: IpcChannel.SCIENTIFIC_VENUE_CREATE,
    args: [venue],
    target: () => harness.venues,
    method: 'createVenue',
    forwarded: [venue],
    outcome: 'passthrough',
  },
  {
    channel: IpcChannel.SCIENTIFIC_VENUE_UPDATE,
    args: [{ id: 3, venueData: venue }],
    target: () => harness.venues,
    method: 'updateVenue',
    forwarded: [3, venue],
    outcome: 'passthrough',
  },
  {
    channel: IpcChannel.SCIENTIFIC_VENUE_DELETE,
    args: [3],
    target: () => harness.venues,
    method: 'deleteVenue',
    forwarded: [3],
    outcome: 'passthrough',
  },
  {
    channel: IpcChannel.SCIENTIFIC_MILESTONE_TOGGLE_STATUS,
    args: [{ milestoneId: 9, status: 'done' }],
    target: () => harness.venues,
    method: 'toggleMilestoneStatus',
    forwarded: [9, 'done'],
    outcome: 'passthrough',
  },
];

const EXPECTED_RESULT: Record<Outcome, (response: object) => unknown> = {
  passthrough: (response) => response,
  void: () => undefined,
  true: () => true,
};

beforeEach(() => {
  resetIpcHarness();
  setupIpcRegistries();
});

describe('IPC channel contract', () => {
  it('registers a handler for every IpcChannel exactly once (plus the title bar channel)', () => {
    const registered = harness.ipcMain.channels();

    expect(new Set(registered).size).toBe(registered.length);
    expect([...registered].sort()).toEqual([...Object.values(IpcChannel), 'UPDATE_TITLE_BAR'].sort());
  });

  it('shares a single IpcChannel definition with the renderer', () => {
    expect(IpcChannel).toBe(RendererIpcChannel);
  });

  it('reports the app version', async () => {
    expect(await invoke(IpcChannel.APP_GET_VERSION)).toBe('9.9.9');
  });
});

describe('IPC delegation', () => {
  it.each(cases)(
    '$channel calls $method with the renderer arguments',
    async ({ channel, args, target, method, forwarded }) => {
      await invoke(channel, ...args);

      expect(target()[method]).toHaveBeenCalledTimes(1);
      expect(target()[method]).toHaveBeenCalledWith(...forwarded);
    },
  );

  it.each(cases)(
    '$channel returns the expected result ($outcome)',
    async ({ channel, args, target, method, outcome }) => {
      const response = { from: method };
      target()[method].mockReturnValue(response);

      expect(await invoke(channel, ...args)).toEqual(EXPECTED_RESULT[outcome](response));
    },
  );

  it('defaults a missing document order to an empty list', async () => {
    await invoke(IpcChannel.PROJECT_DOCUMENTS_REORDER, 1, null);

    expect(harness.db.reorderProjectDocuments).toHaveBeenCalledWith(1, []);
  });
});

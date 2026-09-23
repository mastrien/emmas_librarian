import { describe, it, expect, beforeEach } from 'vitest';
import { projectService as api } from '../api';
import { IpcChannel, type QueryASTNode } from '../../types';
import { FakeElectronApi } from './fakes/FakeElectronApi';

interface RouteCase {
  method: string;
  call: () => Promise<unknown>;
  channel: IpcChannel;
  args: unknown[];
}

const ast = { type: 'term', value: 'x' } as unknown as QueryASTNode;
const questionSet = { project_id: 1, name: 'S', questions: '["q"]' };
const results = [{ question: 'q', answer: 'a', quote: null, status: 'success' as const, error_message: null }];
const venue = { title: 'Conf', category: 'conference' as const, milestones: [] };

const VOID_METHODS = new Set([
  'updateProject',
  'deleteProject',
  'revertSearch',
  'updateArticleStatus',
  'updateArticleMetadata',
  'updateAnnotation',
  'deleteAnnotation',
  'deleteHighlight',
  'setSetting',
  'updateAiModelConfig',
  'restoreAiModelConfigDefaults',
  'unlinkPdf',
  'linkPdfToArticle',
  'openProjectDocument',
  'saveDiaryEntry',
  'deleteDiaryEntry',
  'restoreTrashItem',
  'deleteTrashItemPermanent',
  'emptyTrash',
  'restoreDiaryEntryVersion',
  'deletePendingHighlight',
  'reorderProjectDocuments',
  'deleteProjectDocument',
  'openProjectDocumentExternal',
  'saveInvestigationResults',
  'updateProjectCategory',
  'deleteProjectCategory',
  'setArticleCategory',
  'updateQuestionSet',
  'deleteQuestionSet',
]);

// Arguments must reach the main process in this exact order; handlers destructure positionally.
const routes: RouteCase[] = [
  { method: 'getProjects', call: () => api.getProjects(), channel: IpcChannel.PROJECTS_GET_ALL, args: [] },
  { method: 'createProject', call: () => api.createProject('P'), channel: IpcChannel.PROJECTS_CREATE, args: ['P'] },
  { method: 'getProject', call: () => api.getProject(1), channel: IpcChannel.PROJECTS_GET_ONE, args: [1] },
  { method: 'updateProject', call: () => api.updateProject(1, 'N'), channel: IpcChannel.PROJECTS_UPDATE, args: [1, 'N'] },
  { method: 'getProjectWritingPad', call: () => api.getProjectWritingPad(1), channel: IpcChannel.PROJECTS_GET_WRITING_PAD, args: [1] },
  { method: 'updateProjectWritingPad', call: () => api.updateProjectWritingPad(1, 'c'), channel: IpcChannel.PROJECTS_UPDATE_WRITING_PAD, args: [1, 'c'] },
  { method: 'deleteProject', call: () => api.deleteProject(1), channel: IpcChannel.PROJECTS_DELETE, args: [1] },
  { method: 'getSearchHistory', call: () => api.getSearchHistory(1), channel: IpcChannel.PROJECTS_GET_SEARCH_HISTORY, args: [1] },
  { method: 'revertSearch', call: () => api.revertSearch(9), channel: IpcChannel.SEARCH_REVERT, args: [9] },
  {
    method: 'searchAndPersist',
    call: () => api.searchAndPersist(1, { a: 'q' }, 50, 'date', 'uq'),
    channel: IpcChannel.SEARCH_EXECUTE,
    args: [1, { a: 'q' }, 50, 'date', 'uq'],
  },
  { method: 'translateQuery', call: () => api.translateQuery(ast), channel: IpcChannel.SEARCH_TRANSLATE_QUERY, args: [ast] },
  { method: 'getArticles', call: () => api.getArticles(1), channel: IpcChannel.ARTICLES_GET_BY_PROJECT, args: [1] },
  { method: 'exportCsv', call: () => api.exportCsv(1), channel: IpcChannel.EXPORT_CSV, args: [1] },
  { method: 'exportXlsx', call: () => api.exportXlsx(1), channel: IpcChannel.EXPORT_XLSX, args: [1] },
  { method: 'exportBiblioshiny', call: () => api.exportBiblioshiny(1), channel: IpcChannel.EXPORT_BIBLIOSHINY, args: [1] },
  { method: 'getArticle', call: () => api.getArticle(2), channel: IpcChannel.ARTICLES_GET_ONE, args: [2] },
  {
    method: 'updateArticleStatus',
    call: () => api.updateArticleStatus(2, 'read', 'n'),
    channel: IpcChannel.ARTICLES_UPDATE_STATUS,
    args: [2, 'read', 'n'],
  },
  {
    method: 'updateArticleMetadata',
    call: () => api.updateArticleMetadata(2, { title: 'T' }),
    channel: IpcChannel.ARTICLES_UPDATE_METADATA,
    args: [2, { title: 'T' }],
  },
  { method: 'getAnnotations', call: () => api.getAnnotations(2), channel: IpcChannel.ANNOTATIONS_GET, args: [2] },
  { method: 'updateAnnotation', call: () => api.updateAnnotation(3, 'c'), channel: IpcChannel.ANNOTATIONS_UPDATE, args: [3, 'c'] },
  { method: 'deleteAnnotation', call: () => api.deleteAnnotation(3), channel: IpcChannel.ANNOTATIONS_DELETE, args: [3] },
  { method: 'deleteHighlight', call: () => api.deleteHighlight(4), channel: IpcChannel.HIGHLIGHTS_DELETE, args: [4] },
  { method: 'getSetting', call: () => api.getSetting('k'), channel: IpcChannel.SETTINGS_GET, args: ['k'] },
  { method: 'setSetting', call: () => api.setSetting('k', 'v'), channel: IpcChannel.SETTINGS_SET, args: ['k', 'v'] },
  { method: 'getAiModelConfigs', call: () => api.getAiModelConfigs(), channel: IpcChannel.AI_MODEL_CONFIG_GET_ALL, args: [] },
  {
    method: 'updateAiModelConfig',
    call: () => api.updateAiModelConfig('summary', 'gemini', 'm'),
    channel: IpcChannel.AI_MODEL_CONFIG_UPDATE,
    args: ['summary', 'gemini', 'm'],
  },
  { method: 'restoreAiModelConfigDefaults', call: () => api.restoreAiModelConfigDefaults(), channel: IpcChannel.AI_MODEL_CONFIG_RESTORE, args: [] },
  { method: 'openPdfDialog', call: () => api.openPdfDialog(), channel: IpcChannel.DIALOG_OPEN_FILE, args: [] },
  { method: 'openMultiplePdfsDialog', call: () => api.openMultiplePdfsDialog(), channel: IpcChannel.DIALOG_OPEN_MULTIPLE_FILES, args: [] },
  { method: 'saveExportedFile', call: () => api.saveExportedFile('c', 'f.csv'), channel: IpcChannel.DIALOG_SAVE_FILE, args: ['c', 'f.csv'] },
  { method: 'uploadPdf', call: () => api.uploadPdf(2, '/a.pdf'), channel: IpcChannel.PDF_UPLOAD, args: [2, '/a.pdf'] },
  { method: 'unlinkPdf', call: () => api.unlinkPdf(2), channel: IpcChannel.PDF_UNLINK, args: [2] },
  {
    method: 'createManualArticle',
    call: () => api.createManualArticle(1, { title: 'T' }, '/a.pdf'),
    channel: IpcChannel.ARTICLES_CREATE_MANUAL,
    args: [1, { title: 'T' }, '/a.pdf'],
  },
  {
    method: 'createArticlesFromPdfs',
    call: () => api.createArticlesFromPdfs(1, ['/a.pdf']),
    channel: IpcChannel.ARTICLES_CREATE_FROM_PDFS,
    args: [1, ['/a.pdf']],
  },
  { method: 'getPdfBuffer', call: () => api.getPdfBuffer(2), channel: IpcChannel.PDF_GET, args: [2] },
  { method: 'getStoredPdfs', call: () => api.getStoredPdfs(), channel: IpcChannel.PDF_LIBRARY_LIST, args: [] },
  { method: 'deletePdfLibraryRecord', call: () => api.deletePdfLibraryRecord('/a.pdf'), channel: IpcChannel.PDF_LIBRARY_DELETE, args: ['/a.pdf'] },
  { method: 'linkPdfToArticle', call: () => api.linkPdfToArticle(2, '/a.pdf'), channel: IpcChannel.PDF_LIBRARY_LINK, args: [2, '/a.pdf'] },
  { method: 'uploadPdfToLibrary', call: () => api.uploadPdfToLibrary('/a.pdf'), channel: IpcChannel.PDF_LIBRARY_UPLOAD, args: ['/a.pdf'] },
  {
    method: 'importArticlesFromProject',
    call: () => api.importArticlesFromProject(1, 2, [5, 6]),
    channel: IpcChannel.ARTICLES_IMPORT_FROM_PROJECT,
    args: [1, 2, [5, 6]],
  },
  {
    method: 'openProjectDocument',
    call: () => api.openProjectDocument('http://u', '/f'),
    channel: IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL,
    args: ['http://u', '/f'],
  },
  { method: 'getDiaryEntries', call: () => api.getDiaryEntries(1), channel: IpcChannel.DIARY_GET_ALL, args: [1] },
  { method: 'getDiaryEntry', call: () => api.getDiaryEntry(1, '2026-01-01'), channel: IpcChannel.DIARY_GET_ONE, args: [1, '2026-01-01'] },
  {
    method: 'saveDiaryEntry',
    call: () => api.saveDiaryEntry(1, '2026-01-01', 'c'),
    channel: IpcChannel.DIARY_SAVE,
    args: [1, '2026-01-01', 'c'],
  },
  { method: 'deleteDiaryEntry', call: () => api.deleteDiaryEntry(1, '2026-01-01'), channel: IpcChannel.DIARY_DELETE, args: [1, '2026-01-01'] },
  { method: 'getTrashItems', call: () => api.getTrashItems(), channel: IpcChannel.TRASH_GET_ITEMS, args: [] },
  { method: 'restoreTrashItem', call: () => api.restoreTrashItem('article', 2), channel: IpcChannel.TRASH_RESTORE_ITEM, args: ['article', 2] },
  {
    method: 'deleteTrashItemPermanent',
    call: () => api.deleteTrashItemPermanent('project', 1),
    channel: IpcChannel.TRASH_PERMANENT_DELETE,
    args: ['project', 1],
  },
  { method: 'emptyTrash', call: () => api.emptyTrash(), channel: IpcChannel.TRASH_EMPTY, args: [] },
  {
    method: 'getDiaryEntryHistory',
    call: () => api.getDiaryEntryHistory(1, '2026-01-01'),
    channel: IpcChannel.DIARY_GET_HISTORY,
    args: [1, '2026-01-01'],
  },
  { method: 'restoreDiaryEntryVersion', call: () => api.restoreDiaryEntryVersion(7), channel: IpcChannel.DIARY_RESTORE_VERSION, args: [7] },
  { method: 'exportBackup', call: () => api.exportBackup(), channel: IpcChannel.BACKUP_EXPORT, args: [] },
  { method: 'restoreBackupOverride', call: () => api.restoreBackupOverride(), channel: IpcChannel.BACKUP_RESTORE_OVERRIDE, args: [] },
  { method: 'restoreBackupMerge', call: () => api.restoreBackupMerge(), channel: IpcChannel.BACKUP_RESTORE_MERGE, args: [] },
  { method: 'listAutoBackups', call: () => api.listAutoBackups(), channel: IpcChannel.BACKUP_LIST_AUTO, args: [] },
  { method: 'restoreAutoBackup', call: () => api.restoreAutoBackup('b.zip'), channel: IpcChannel.BACKUP_RESTORE_AUTO, args: ['b.zip'] },
  { method: 'getAppVersion', call: () => api.getAppVersion(), channel: IpcChannel.APP_GET_VERSION, args: [] },
  { method: 'generateSummary', call: () => api.generateSummary(2), channel: IpcChannel.AI_GENERATE_SUMMARY, args: [2] },
  { method: 'massiveExtraction', call: () => api.massiveExtraction(2, ['q']), channel: IpcChannel.AI_MASSIVE_EXTRACTION, args: [2, ['q']] },
  { method: 'extractMetadata', call: () => api.extractMetadata(2), channel: IpcChannel.AI_EXTRACT_METADATA, args: [2] },
  { method: 'getPendingHighlights', call: () => api.getPendingHighlights(2), channel: IpcChannel.PENDING_HIGHLIGHTS_GET, args: [2] },
  { method: 'deletePendingHighlight', call: () => api.deletePendingHighlight(8), channel: IpcChannel.PENDING_HIGHLIGHTS_DELETE, args: [8] },
  { method: 'getProjectDocuments', call: () => api.getProjectDocuments(1), channel: IpcChannel.PROJECT_DOCUMENTS_GET, args: [1] },
  {
    method: 'reorderProjectDocuments',
    call: () => api.reorderProjectDocuments(1, [3, 2]),
    channel: IpcChannel.PROJECT_DOCUMENTS_REORDER,
    args: [1, [3, 2]],
  },
  { method: 'deleteProjectDocument', call: () => api.deleteProjectDocument(3), channel: IpcChannel.PROJECT_DOCUMENTS_DELETE, args: [3] },
  {
    method: 'openProjectDocumentExternal',
    call: () => api.openProjectDocumentExternal(undefined, '/f'),
    channel: IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL,
    args: [undefined, '/f'],
  },
  { method: 'getMassiveInvestigations', call: () => api.getMassiveInvestigations(1), channel: IpcChannel.MASSIVE_INVESTIGATIONS_GET, args: [1] },
  {
    method: 'saveMassiveInvestigation',
    call: () => api.saveMassiveInvestigation(1, ['q'], [2], 'm', 'done'),
    channel: IpcChannel.MASSIVE_INVESTIGATIONS_SAVE,
    args: [1, ['q'], [2], 'm', 'done'],
  },
  {
    method: 'saveInvestigationResults',
    call: () => api.saveInvestigationResults(4, 2, results),
    channel: IpcChannel.INVESTIGATION_RESULTS_SAVE,
    args: [4, 2, results],
  },
  { method: 'getInvestigationResults', call: () => api.getInvestigationResults(4), channel: IpcChannel.INVESTIGATION_RESULTS_GET, args: [4] },
  {
    method: 'getInvestigationResultsByArticle',
    call: () => api.getInvestigationResultsByArticle(4, 2),
    channel: IpcChannel.INVESTIGATION_RESULTS_GET_BY_ARTICLE,
    args: [4, 2],
  },
  { method: 'getProjectCategories', call: () => api.getProjectCategories(1), channel: IpcChannel.CATEGORIES_GET_PROJECT, args: [1] },
  {
    method: 'createProjectCategory',
    call: () => api.createProjectCategory(1, 'C', 'select', { options: ['a'] }),
    channel: IpcChannel.CATEGORIES_CREATE_PROJECT,
    args: [1, 'C', 'select', { options: ['a'] }],
  },
  {
    method: 'updateProjectCategory',
    call: () => api.updateProjectCategory(5, 'C', 'text', null),
    channel: IpcChannel.CATEGORIES_UPDATE_PROJECT,
    args: [5, 'C', 'text', null],
  },
  { method: 'deleteProjectCategory', call: () => api.deleteProjectCategory(5), channel: IpcChannel.CATEGORIES_DELETE_PROJECT, args: [5] },
  { method: 'getArticleCategories', call: () => api.getArticleCategories(2), channel: IpcChannel.CATEGORIES_GET_ARTICLE, args: [2] },
  {
    method: 'setArticleCategory',
    call: () => api.setArticleCategory(2, 5, 'v'),
    channel: IpcChannel.CATEGORIES_SET_ARTICLE,
    args: [2, 5, 'v'],
  },
  {
    method: 'getAllProjectArticleCategories',
    call: () => api.getAllProjectArticleCategories(1),
    channel: IpcChannel.CATEGORIES_GET_ALL_PROJECT_ARTICLE,
    args: [1],
  },
  { method: 'getQuestionSets', call: () => api.getQuestionSets(1), channel: IpcChannel.QUESTION_SETS_LIST, args: [1] },
  { method: 'getQuestionSet', call: () => api.getQuestionSet(6), channel: IpcChannel.QUESTION_SETS_GET, args: [6] },
  { method: 'createQuestionSet', call: () => api.createQuestionSet(questionSet), channel: IpcChannel.QUESTION_SETS_CREATE, args: [questionSet] },
  {
    method: 'updateQuestionSet',
    call: () => api.updateQuestionSet(6, { name: 'S2' }),
    channel: IpcChannel.QUESTION_SETS_UPDATE,
    args: [6, { name: 'S2' }],
  },
  { method: 'deleteQuestionSet', call: () => api.deleteQuestionSet(6), channel: IpcChannel.QUESTION_SETS_DELETE, args: [6] },
  { method: 'duplicateQuestionSet', call: () => api.duplicateQuestionSet(6, 1), channel: IpcChannel.QUESTION_SETS_DUPLICATE, args: [6, 1] },
  { method: 'exportProject', call: () => api.exportProject(1), channel: IpcChannel.SYNC_EXPORT_PROJECT, args: [1] },
  { method: 'importProject', call: () => api.importProject('/p.zip'), channel: IpcChannel.SYNC_IMPORT_PROJECT, args: ['/p.zip'] },
  { method: 'getScientificVenues', call: () => api.getScientificVenues(), channel: IpcChannel.SCIENTIFIC_VENUES_GET_ALL, args: [] },
  { method: 'createScientificVenue', call: () => api.createScientificVenue(venue), channel: IpcChannel.SCIENTIFIC_VENUE_CREATE, args: [venue] },
  { method: 'deleteScientificVenue', call: () => api.deleteScientificVenue(3), channel: IpcChannel.SCIENTIFIC_VENUE_DELETE, args: [3] },
];

describe('api.ts IPC routing', () => {
  let bridge: FakeElectronApi;

  beforeEach(() => {
    bridge = FakeElectronApi.install();
  });

  it.each(routes)('$method invokes $channel with positional args', async ({ call, channel, args }) => {
    await call();

    expect(bridge.invocations).toEqual([{ channel, args }]);
  });

  it.each(routes.filter((r) => !VOID_METHODS.has(r.method)))(
    '$method passes the main-process response through unchanged',
    async ({ call, channel }) => {
      const response = { marker: channel };
      bridge.respondWith(channel, response);

      expect(await call()).toBe(response);
    },
  );

  it.each(routes.filter((r) => VOID_METHODS.has(r.method)))('$method resolves to undefined', async ({ call, channel }) => {
    bridge.respondWith(channel, { marker: channel });

    expect(await call()).toBeUndefined();
  });
});

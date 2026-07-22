// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupIpcRegistries } from '../ipcRegistries';
import { ipcMain, app, dialog, shell, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { IpcChannel } from '../../types';

// Mock dependencies
vi.mock('electron', () => {
  return {
    ipcMain: {
      handle: vi.fn(),
    },
    app: {
      getPath: vi.fn().mockReturnValue('/mocked/path'),
      getVersion: vi.fn().mockReturnValue('1.0.0'),
    },
    dialog: {
      showSaveDialog: vi.fn(),
      showOpenDialog: vi.fn(),
    },
    shell: {
      openPath: vi.fn(),
      openExternal: vi.fn(),
    },
    BrowserWindow: {
      fromWebContents: vi.fn(),
    },
  };
});

vi.mock('fs', () => {
  return {
    default: {
      existsSync: vi.fn(),
      mkdirSync: vi.fn(),
      copyFileSync: vi.fn(),
      readFileSync: vi.fn().mockReturnValue(Buffer.from('')),
      unlinkSync: vi.fn(),
      writeFileSync: vi.fn(),
      readdirSync: vi.fn().mockReturnValue([]),
      statSync: vi.fn().mockReturnValue({ size: 1024 }),
    },
  };
});

vi.mock('../../database/DatabaseAdapter', () => {
  return {
    DatabaseAdapter: vi.fn().mockImplementation(() => {
      const Database = require('better-sqlite3');
      const fsLib = require('fs');
      const pathLib = require('path');
      const db = new Database(':memory:');

      try {
        const schemaPath = pathLib.resolve(__dirname, 'electron/database/schema.sql');
        const schema = fsLib.readFileSync(schemaPath, 'utf-8');
        db.exec(schema);
      } catch (err) {
        try {
          const schemaPath = pathLib.resolve(__dirname, '../../database/schema.sql');
          const schema = fsLib.readFileSync(schemaPath, 'utf-8');
          db.exec(schema);
        } catch (e) {
          console.error('Failed to load schema', e);
        }
      }

      return {
        getDB: vi.fn().mockReturnValue(db),
        getAllProjects: vi.fn().mockReturnValue([{ id: 1, name: 'Project 1' }]),
        createProject: vi.fn().mockReturnValue(1),
        getProject: vi.fn().mockReturnValue({ id: 1, name: 'Project 1' }),
        getSearchHistory: vi.fn().mockReturnValue([]),
        updateProject: vi.fn(),
        deleteProject: vi.fn(),
        getArticlesByProject: vi.fn().mockReturnValue([]),
        getArticle: vi.fn().mockReturnValue({ id: 1, local_file_path: '/mocked/path/file.pdf' }),
        updateArticleStatus: vi.fn(),
        updateArticleMetadata: vi.fn(),
        getSetting: vi.fn(),
        setSetting: vi.fn(),
        getAnnotations: vi.fn().mockReturnValue([]),
        saveAnnotation: vi.fn().mockReturnValue(1),
        updateAnnotation: vi.fn(),
        deleteAnnotation: vi.fn(),
        getHighlights: vi.fn().mockReturnValue([]),
        saveHighlight: vi.fn().mockReturnValue(1),
        deleteHighlight: vi.fn(),
        updateArticleFilePath: vi.fn(),
        saveArticle: vi.fn().mockReturnValue(1),
        saveSearchHistory: vi.fn(),
        getDiaryEntries: vi.fn().mockReturnValue([]),
        getDiaryEntry: vi.fn().mockReturnValue(null),
        saveDiaryEntry: vi.fn(),
        deleteDiaryEntry: vi.fn(),
        getPendingHighlights: vi.fn().mockReturnValue([]),
        deletePendingHighlight: vi.fn(),
        getProjectDocuments: vi.fn().mockReturnValue([]),
        saveProjectDocument: vi.fn().mockReturnValue(1),
        deleteProjectDocument: vi.fn(),
        getMassiveInvestigations: vi.fn().mockReturnValue([]),
        saveMassiveInvestigation: vi.fn(),
        getProjectCategories: vi.fn().mockReturnValue([]),
        getAllProjectArticleCategories: vi.fn().mockReturnValue([]),
        checkIntegrity: vi.fn().mockReturnValue(true),
        getTrashItems: vi.fn().mockReturnValue([]),
        restoreTrashItem: vi.fn(),
        deleteTrashItemPermanent: vi.fn(),
        emptyTrash: vi.fn(),
        getDiaryEntryHistory: vi.fn().mockReturnValue([]),
        restoreDiaryEntryVersion: vi.fn(),
        registerPdfInLibrary: vi.fn(),
        linkPdfToArticle: vi.fn(),
        getPdfByHash: vi.fn().mockReturnValue(null),
        getArticlesForPdf: vi.fn().mockReturnValue([]),
        unlinkPdfFromArticle: vi.fn(),
        getStoredPdfs: vi.fn().mockReturnValue([]),
        deletePdfLibraryRecord: vi.fn().mockReturnValue([]),
        deletePdfRecord: vi.fn(),
        importArticlesFromProject: vi.fn(),
      };
    }),
  };
});

vi.mock('../../services/SearchOrchestrator', () => ({
  SearchOrchestrator: vi.fn().mockImplementation(() => ({
    searchAndPersist: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../services/QueryTranslator', () => ({
  QueryTranslator: vi.fn(),
  queryTranslator: { translate: vi.fn().mockReturnValue('translated') },
}));

vi.mock('../../services/ApiIntegrator', () => ({
  ApiIntegrator: vi.fn(),
}));

vi.mock('../../services/ExportService', () => ({
  ExportService: vi.fn().mockImplementation(() => ({
    exportToCsv: vi.fn().mockReturnValue('csv content'),
    exportToBiblioshiny: vi.fn().mockReturnValue('biblioshiny content'),
  })),
}));

vi.mock('../../services/AIService', () => ({
  AIService: vi.fn().mockImplementation(() => ({
    generateSummary: vi.fn().mockResolvedValue('summary'),
    massiveExtraction: vi.fn().mockResolvedValue([]),
    extractMetadataFromPdf: vi.fn().mockResolvedValue({}),
  })),
}));

describe('IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers all ipcMain handlers', () => {
    setupIpcRegistries();
    expect(ipcMain.handle).toHaveBeenCalled();
    // Check if it registered key channels
    const channels = (ipcMain.handle as unknown).mock.calls.map((call: unknown[]) => call[0]);
    expect(channels).toContain(IpcChannel.PROJECTS_GET_ALL);
    expect(channels).toContain(IpcChannel.SEARCH_EXECUTE);
    expect(channels).toContain(IpcChannel.ARTICLES_GET_ONE);
  });

  it('handles PROJECTS_GET_ALL', async () => {
    setupIpcRegistries();
    const handleCall = (ipcMain.handle as unknown).mock.calls.find(
      (c: unknown) => c[0] === IpcChannel.PROJECTS_GET_ALL,
    );
    expect(handleCall).toBeDefined();
    const handlerFn = handleCall[1];

    const result = await handlerFn({} as unknown);
    expect(result).toEqual([{ id: 1, name: 'Project 1' }]);
  });

  it('handles PDF_UPLOAD', async () => {
    setupIpcRegistries();
    const handleCall = (ipcMain.handle as unknown).mock.calls.find((c: unknown) => c[0] === IpcChannel.PDF_UPLOAD);
    const handlerFn = handleCall[1];

    fs.existsSync.mockReturnValue(false); // mock dir doesn't exist

    const result = await handlerFn({} as unknown, 1, '/source.pdf');
    expect(fs.mkdirSync).toHaveBeenCalledWith(path.join('/mocked/path', 'storage', 'pdfs'), { recursive: true });
    expect(fs.copyFileSync).toHaveBeenCalled();
    expect(result).toContain('.pdf');
  });

  it('handles EXPORT_CSV', async () => {
    setupIpcRegistries();
    const handleCall = (ipcMain.handle as unknown).mock.calls.find((c: unknown) => c[0] === IpcChannel.EXPORT_CSV);
    const handlerFn = handleCall[1];

    dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/saved/file.csv' });

    const result = await handlerFn({} as unknown, 1);
    expect(dialog.showSaveDialog).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith('/saved/file.csv', 'csv content');
    expect(result).toBe('/saved/file.csv');
  });

  it('handles APP_GET_VERSION', async () => {
    setupIpcRegistries();
    const handleCall = (ipcMain.handle as unknown).mock.calls.find((c: unknown) => c[0] === IpcChannel.APP_GET_VERSION);
    const handlerFn = handleCall[1];

    const result = await handlerFn({} as unknown);
    expect(result).toBe('1.0.0');
    expect(app.getVersion).toHaveBeenCalled();
  });

  it('handles basic database operations', async () => {
    setupIpcRegistries();

    const callHandler = async (channel: string, ...args: unknown[]) => {
      const handleCall = (ipcMain.handle as unknown).mock.calls.find((c: unknown) => c[0] === channel);
      if (handleCall) return handleCall[1]({} as unknown, ...args);
      throw new Error(`Handler not found for ${channel}`);
    };

    // Projects
    expect(await callHandler(IpcChannel.PROJECTS_CREATE, 'New Proj')).toBe(1);
    expect(await callHandler(IpcChannel.PROJECTS_GET_ONE, 1)).toEqual({ id: 1, name: 'Project 1' });
    expect(await callHandler(IpcChannel.PROJECTS_GET_SEARCH_HISTORY, 1)).toEqual([]);

    // Articles
    expect(await callHandler(IpcChannel.ARTICLES_GET_BY_PROJECT, 1)).toEqual([]);
    expect(await callHandler(IpcChannel.ARTICLES_GET_ONE, 1)).toEqual({
      id: 1,
      local_file_path: '/mocked/path/file.pdf',
    });

    // Settings
    expect(await callHandler(IpcChannel.SETTINGS_GET, 'key')).toBeUndefined();

    // Annotations
    expect(await callHandler(IpcChannel.ANNOTATIONS_GET, 1)).toEqual([]);
    expect(await callHandler(IpcChannel.ANNOTATIONS_CREATE, 1, 'content')).toBe(1);

    // Highlights
    expect(await callHandler(IpcChannel.HIGHLIGHTS_GET, 1)).toEqual([]);
    expect(await callHandler(IpcChannel.HIGHLIGHTS_CREATE, 1, 'red', '{}', 'quote', 'comment')).toBe(1);

    // PDF
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from('test'));
    const buf = await callHandler(IpcChannel.PDF_GET, 1);
    expect(buf).toBeDefined(); // mock fs returns undefined or mock value, actually fs.readFileSync is mocked

    // Diary
    expect(await callHandler(IpcChannel.DIARY_GET_ALL, 1)).toEqual([]);

    // AI
    expect(await callHandler(IpcChannel.AI_GENERATE_SUMMARY, 1)).toEqual('summary');
    expect(await callHandler(IpcChannel.AI_MASSIVE_EXTRACTION, 1, ['q1'])).toEqual([]);
    expect(await callHandler(IpcChannel.AI_EXTRACT_METADATA, 1)).toEqual({});

    // Pending highlights
    expect(await callHandler(IpcChannel.PENDING_HIGHLIGHTS_GET, 1)).toEqual([]);

    // Documents
    expect(await callHandler(IpcChannel.PROJECT_DOCUMENTS_GET, 1)).toEqual([]);
    expect(await callHandler(IpcChannel.PROJECT_DOCUMENTS_CREATE, 1, 'title')).toBe(1);
    // Investigations
    expect(await callHandler(IpcChannel.MASSIVE_INVESTIGATIONS_GET, 1)).toEqual([]);

    // Trash Bin
    expect(await callHandler(IpcChannel.TRASH_GET_ITEMS)).toEqual([]);
    await callHandler(IpcChannel.TRASH_RESTORE_ITEM, 'project', 1);
    await callHandler(IpcChannel.TRASH_PERMANENT_DELETE, 'project', 1);
    await callHandler(IpcChannel.TRASH_EMPTY);

    // Diary History
    expect(await callHandler(IpcChannel.DIARY_GET_HISTORY, 1, '2026-06-05')).toEqual([]);
    await callHandler(IpcChannel.DIARY_RESTORE_VERSION, 1);
  });
});

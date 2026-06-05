import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from '../database/SyncService';
import { dialog, app } from 'electron';
import fs from 'fs';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/userData'),
    relaunch: vi.fn(),
    exit: vi.fn(),
    getVersion: vi.fn().mockReturnValue('1.1.11')
  },
  dialog: {
    showSaveDialog: vi.fn().mockImplementation((...args) => (globalThis as any).mockShowSaveDialog(...args)),
    showOpenDialog: vi.fn().mockImplementation((...args) => (globalThis as any).mockShowOpenDialog(...args))
  }
}));

vi.mock('adm-zip', () => {
  const MockZip = vi.fn().mockImplementation(() => ({
    addFile: vi.fn().mockImplementation((...args) => {
      if ((globalThis as any).mockAddFile) {
        (globalThis as any).mockAddFile(...args);
      }
    }),
    addLocalFile: vi.fn(),
    addLocalFolder: vi.fn(),
    writeZip: vi.fn(),
    getEntry: vi.fn().mockImplementation((...args) => (globalThis as any).mockGetEntry(...args)),
    getEntries: vi.fn().mockReturnValue([])
  }));
  return {
    default: MockZip
  };
});

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(Buffer.from('mock db data')),
    unlinkSync: vi.fn(),
  }
}));

describe('SyncService', () => {
  let mockDbManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).mockAddFile = vi.fn();
    (globalThis as any).mockShowSaveDialog = vi.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/test.emmapcarc' });
    (globalThis as any).mockShowOpenDialog = vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/tmp/test.emmapcarc'] });
    (globalThis as any).mockGetEntry = vi.fn().mockReturnValue({
      getData: () => Buffer.from(JSON.stringify({
        project: { name: 'Test' },
        articles: [],
        searchHistory: [],
        projectDocs: [],
        massiveInvs: [],
        projCategories: [],
        articleCategories: []
      }))
    });

    mockDbManager = {
      db: {
        transaction: vi.fn(fn => fn),
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ id: 1, name: 'Test' }),
          all: vi.fn().mockReturnValue([]),
          run: vi.fn().mockReturnValue({ lastInsertRowid: 10 })
        })
      }
    };
  });

  it('exports project successfully with default mock database', async () => {
    const service = new SyncService(mockDbManager);
    const result = await service.exportProject(1);
    expect(result).toBe('/tmp/test.emmapcarc');
  });

  it('returns null on export if canceled', async () => {
    (globalThis as any).mockShowSaveDialog.mockResolvedValueOnce({ canceled: true });
    const service = new SyncService(mockDbManager);
    const result = await service.exportProject(1);
    expect(result).toBeNull();
  });

  it('throws error if project to export is not found', async () => {
    mockDbManager.db.prepare = vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(undefined)
    });
    const service = new SyncService(mockDbManager);
    await expect(service.exportProject(999)).rejects.toThrow('Projeto não encontrado');
  });

  it('exports with articles and documents paths', async () => {
    mockDbManager.db.prepare = vi.fn((sql) => {
      let mockReturn: any[] = [];
      if (sql.includes('FROM projects')) {
        return { get: () => ({ id: 1, name: 'Test' }) };
      }
      if (sql.includes('FROM articles')) {
        mockReturn = [{ id: 2, local_file_path: '/path/to/art.pdf' }];
      }
      if (sql.includes('FROM project_documents')) {
        mockReturn = [{ id: 3, file_path: '/path/to/doc.pdf' }];
      }
      return { all: () => mockReturn };
    });

    const service = new SyncService(mockDbManager);
    const result = await service.exportProject(1);
    expect(result).toBe('/tmp/test.emmapcarc');
  });

  it('imports project successfully', async () => {
    const service = new SyncService(mockDbManager);
    const result = await service.importProject();
    expect(result).toBe(10);
  });

  it('imports project with a provided path', async () => {
    const service = new SyncService(mockDbManager);
    const result = await service.importProject('/provided/path.emmapcarc');
    expect(result).toBe(10);
  });

  it('returns null on import if dialog is canceled', async () => {
    (globalThis as any).mockShowOpenDialog.mockResolvedValueOnce({ canceled: true });
    const service = new SyncService(mockDbManager);
    const result = await service.importProject();
    expect(result).toBeNull();
  });

  it('throws error on import if project.json is missing', async () => {
    (globalThis as any).mockGetEntry.mockReturnValueOnce(null);
    const service = new SyncService(mockDbManager);
    await expect(service.importProject()).rejects.toThrow('Arquivo de projeto inválido');
  });

  it('imports project with articles, docs, and massive investigations data successfully', async () => {
    (globalThis as any).mockGetEntry.mockReturnValueOnce({
      getData: () => Buffer.from(JSON.stringify({
        project: { name: 'Test' },
        articles: [{ id: 100, title: 'Art Title', local_file_path: '/old/art.pdf' }],
        searchHistory: [{ unified_query: 'test', translated_queries: '{}', total_results: 1, results_breakdown: '{}' }],
        projectDocs: [{ title: 'Doc', local_file_path: '/old/doc.pdf' }],
        projCategories: [{ id: 50, name: 'Cat', type: 'text', options: '' }],
        articleCategories: [{ article_id: 100, category_id: 50, value: 'RCT' }],
        massiveInvs: [{ created_at: '2026-06-03T12:00:00.000Z', status: 'Sucesso', model_used: 'model', questions: '[]', articles_ids: '[100]' }]
      }))
    });

    const service = new SyncService(mockDbManager);
    const result = await service.importProject();
    expect(result).toBe(10);
  });

  it('exports highlights, annotations, pending highlights, and project diary entries successfully', async () => {
    const mockAddFile = vi.fn();
    (globalThis as any).mockAddFile = mockAddFile;

    mockDbManager.db.prepare = vi.fn((sql) => {
      let mockReturn: any[] = [];
      if (sql.includes('FROM projects')) {
        return { get: () => ({ id: 1, name: 'Test' }) };
      }
      if (sql.includes('FROM annotations')) {
        mockReturn = [{ id: 10, article_id: 2, content_markdown: 'Note 1' }];
      } else if (sql.includes('FROM highlights')) {
        mockReturn = [{ id: 20, article_id: 2, color: 'yellow', position_data: '{}', annotation_id: 10 }];
      } else if (sql.includes('FROM pending_highlights')) {
        mockReturn = [{ id: 30, article_id: 2, quote: 'test' }];
      } else if (sql.includes('FROM project_diary')) {
        mockReturn = [{ id: 40, project_id: 1, entry_date: '2026-06-05', content: 'Diary text' }];
      }
      return { all: () => mockReturn };
    });

    const service = new SyncService(mockDbManager);
    await service.exportProject(1);

    expect(mockAddFile).toHaveBeenCalled();
    const [filename, contentBuffer] = mockAddFile.mock.calls[0];
    expect(filename).toBe('project.json');
    const parsedData = JSON.parse(contentBuffer.toString('utf-8'));

    expect(parsedData).toHaveProperty('annotations');
    expect(parsedData).toHaveProperty('highlights');
    expect(parsedData).toHaveProperty('pendingHighlights');
    expect(parsedData).toHaveProperty('diaryEntries');

    expect(parsedData.annotations[0].content_markdown).toBe('Note 1');
    expect(parsedData.highlights[0].color).toBe('yellow');
    expect(parsedData.pendingHighlights[0].quote).toBe('test');
    expect(parsedData.diaryEntries[0].content).toBe('Diary text');
  });

  it('imports project with annotations, highlights, pending highlights, and diary entries remapping IDs successfully', async () => {
    const runSpy = vi.fn().mockReturnValue({ lastInsertRowid: 777 });
    mockDbManager.db.prepare = vi.fn().mockReturnValue({
      run: runSpy,
      all: vi.fn().mockReturnValue([])
    });

    (globalThis as any).mockGetEntry.mockReturnValueOnce({
      getData: () => Buffer.from(JSON.stringify({
        project: { name: 'Test' },
        articles: [{ id: 100, title: 'Art Title' }],
        searchHistory: [],
        projectDocs: [],
        projCategories: [],
        articleCategories: [],
        massiveInvs: [],
        annotations: [{ id: 10, article_id: 100, content_markdown: 'Note 1' }],
        highlights: [{ id: 20, article_id: 100, color: 'yellow', position_data: '{}', annotation_id: 10 }],
        pendingHighlights: [{ id: 30, article_id: 100, quote: 'test' }],
        diaryEntries: [{ id: 40, project_id: 99, entry_date: '2026-06-05', content: 'Diary text' }]
      }))
    });

    const service = new SyncService(mockDbManager);
    const result = await service.importProject();
    expect(result).toBe(777); // returns new project id

    const preparedSQLs = mockDbManager.db.prepare.mock.calls.map((c: any) => c[0]);
    expect(preparedSQLs.some((sql: string) => sql.includes('INSERT INTO annotations'))).toBe(true);
    expect(preparedSQLs.some((sql: string) => sql.includes('INSERT INTO highlights'))).toBe(true);
    expect(preparedSQLs.some((sql: string) => sql.includes('INSERT INTO pending_highlights'))).toBe(true);
    expect(preparedSQLs.some((sql: string) => sql.includes('INSERT OR REPLACE INTO project_diary'))).toBe(true);
  });

  describe('Full Backup & Restore', () => {
    it('exports backup successfully', async () => {
      const mockAddFile = vi.fn();
      const mockAddLocalFolder = vi.fn();
      const mockWriteZip = vi.fn();
      
      (globalThis as any).mockAddFile = mockAddFile;
      (globalThis as any).mockShowSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: '/tmp/backup.emmabak' });

      // Mock database prepared queries for count
      mockDbManager.db.prepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ count: 5 })
      });

      const service = new SyncService(mockDbManager);
      const result = await service.exportBackup();

      expect(result).toBe('/tmp/backup.emmabak');
      expect(mockAddFile).toHaveBeenCalled();
      const metadataCall = mockAddFile.mock.calls.find((call: any) => call[0] === 'backup_metadata.json');
      expect(metadataCall).toBeDefined();
      const metadata = JSON.parse(metadataCall![1].toString('utf-8'));
      expect(metadata.projectCount).toBe(5);
    });

    it('returns null on export backup if canceled', async () => {
      (globalThis as any).mockShowSaveDialog.mockResolvedValueOnce({ canceled: true });
      const service = new SyncService(mockDbManager);
      const result = await service.exportBackup();
      expect(result).toBeNull();
    });

    it('restores backup override successfully', async () => {
      const mockGetEntry = vi.fn().mockReturnValue({
        getData: () => Buffer.from('mock db data')
      });
      (globalThis as any).mockGetEntry = mockGetEntry;
      
      const mockClose = vi.fn();
      mockDbManager.close = mockClose;

      const service = new SyncService(mockDbManager);
      const result = await service.restoreBackupOverride('/tmp/backup.emmabak');

      expect(result).toBe(true);
      expect(mockClose).toHaveBeenCalled();
      expect(app.relaunch).toHaveBeenCalled();
      expect(app.exit).toHaveBeenCalled();
    });

    it('returns false on restore backup override if canceled', async () => {
      (globalThis as any).mockShowOpenDialog.mockResolvedValueOnce({ canceled: true });
      const service = new SyncService(mockDbManager);
      const result = await service.restoreBackupOverride();
      expect(result).toBe(false);
    });
  });
});

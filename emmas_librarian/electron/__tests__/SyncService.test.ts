import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from '../database/SyncService';
import { dialog, app } from 'electron';
import fs from 'fs';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/userData'),
    relaunch: vi.fn(),
    exit: vi.fn(),
    getVersion: vi.fn().mockReturnValue('1.1.11'),
  },
  dialog: {
    showSaveDialog: vi.fn().mockImplementation((...args) => (globalThis as unknown).mockShowSaveDialog(...args)),
    showOpenDialog: vi.fn().mockImplementation((...args) => (globalThis as unknown).mockShowOpenDialog(...args)),
  },
}));

vi.mock('adm-zip', () => {
  const MockZip = vi.fn().mockImplementation(() => ({
    addFile: vi.fn().mockImplementation((...args) => {
      if ((globalThis as unknown).mockAddFile) {
        (globalThis as unknown).mockAddFile(...args);
      }
    }),
    addLocalFile: vi.fn(),
    addLocalFolder: vi.fn(),
    writeZip: vi.fn(),
    getEntry: vi.fn().mockImplementation((...args) => (globalThis as unknown).mockGetEntry(...args)),
    getEntries: vi.fn().mockReturnValue([]),
  }));
  return {
    default: MockZip,
  };
});

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(Buffer.from('mock db data')),
    unlinkSync: vi.fn(),
  },
}));

describe('SyncService', () => {
  let mockdbAdapter: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown).mockAddFile = vi.fn();
    (globalThis as unknown).mockShowSaveDialog = vi
      .fn()
      .mockResolvedValue({ canceled: false, filePath: '/tmp/test.emmapcarc' });
    (globalThis as unknown).mockShowOpenDialog = vi
      .fn()
      .mockResolvedValue({ canceled: false, filePaths: ['/tmp/test.emmapcarc'] });
    (globalThis as unknown).mockGetEntry = vi.fn().mockReturnValue({
      getData: () =>
        Buffer.from(
          JSON.stringify({
            project: { name: 'Test' },
            articles: [],
            searchHistory: [],
            projectDocs: [],
            massiveInvs: [],
            projCategories: [],
            articleCategories: [],
          }),
        ),
    });

    mockdbAdapter = {
      db: {
        transaction: vi.fn((fn) => fn),
        pragma: vi.fn(),
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ id: 1, name: 'Test' }),
          all: vi.fn().mockReturnValue([]),
          run: vi.fn().mockReturnValue({ lastInsertRowid: 10 }),
        }),
      },
    };
    // Same contract as DatabaseAdapter: getDB() exposes the connection, checkpoint() flushes the WAL.
    mockdbAdapter.getDB = () => mockdbAdapter.db;
    mockdbAdapter.checkpoint = () => mockdbAdapter.db.pragma('wal_checkpoint(TRUNCATE)');
  });

  it('exports project successfully with default mock database', async () => {
    const service = new SyncService(mockdbAdapter);
    const result = await service.exportProject(1);
    expect(result).toBe('/tmp/test.emmapcarc');
  });

  it('returns null on export if canceled', async () => {
    (globalThis as unknown).mockShowSaveDialog.mockResolvedValueOnce({ canceled: true });
    const service = new SyncService(mockdbAdapter);
    const result = await service.exportProject(1);
    expect(result).toBeNull();
  });

  it('throws error if project to export is not found', async () => {
    mockdbAdapter.db.prepare = vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
    });
    const service = new SyncService(mockdbAdapter);
    await expect(service.exportProject(999)).rejects.toThrow('Projeto não encontrado');
  });

  it('exports with articles and documents paths', async () => {
    mockdbAdapter.db.prepare = vi.fn((sql) => {
      let mockReturn: unknown[] = [];
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

    const service = new SyncService(mockdbAdapter);
    const result = await service.exportProject(1);
    expect(result).toBe('/tmp/test.emmapcarc');
  });

  it('returns null on import if dialog is canceled', async () => {
    (globalThis as unknown).mockShowOpenDialog.mockResolvedValueOnce({ canceled: true });
    const service = new SyncService(mockdbAdapter);
    const result = await service.importProject();
    expect(result).toBeNull();
  });

  it('throws error on import if project.json is missing', async () => {
    (globalThis as unknown).mockGetEntry.mockReturnValueOnce(null);
    const service = new SyncService(mockdbAdapter);
    await expect(service.importProject()).rejects.toThrow('Arquivo de projeto inválido');
  });

  it('exports highlights, annotations, pending highlights, diary entries, and diary history successfully', async () => {
    const mockAddFile = vi.fn();
    (globalThis as unknown).mockAddFile = mockAddFile;

    mockdbAdapter.db.prepare = vi.fn((sql) => {
      let mockReturn: unknown[] = [];
      if (sql.includes('FROM projects')) {
        return { get: () => ({ id: 1, name: 'Test', writing_pad: 'pad content', last_executed_at: '2026-01-01' }) };
      }
      if (sql.includes('FROM annotations')) {
        mockReturn = [{ id: 10, article_id: 2, content_markdown: 'Note 1' }];
      } else if (sql.includes('FROM project_diary_history')) {
        mockReturn = [
          { id: 5, project_id: 1, entry_date: '2026-06-05', content: 'Old version', updated_at: '2026-06-05T10:00:00' },
        ];
      } else if (sql.includes('FROM highlights')) {
        mockReturn = [{ id: 20, article_id: 2, color: 'yellow', position_data: '{}', annotation_id: 10 }];
      } else if (sql.includes('FROM pending_highlights')) {
        mockReturn = [{ id: 30, article_id: 2, quote: 'test' }];
      } else if (sql.includes('FROM project_diary')) {
        mockReturn = [{ id: 40, project_id: 1, entry_date: '2026-06-05', content: 'Diary text' }];
      }
      return { all: () => mockReturn };
    });

    const service = new SyncService(mockdbAdapter);
    await service.exportProject(1);

    expect(mockAddFile).toHaveBeenCalled();
    const [filename, contentBuffer] = mockAddFile.mock.calls[0];
    expect(filename).toBe('project.json');
    const parsedData = JSON.parse(contentBuffer.toString('utf-8'));

    expect(parsedData).toHaveProperty('annotations');
    expect(parsedData).toHaveProperty('highlights');
    expect(parsedData).toHaveProperty('pendingHighlights');
    expect(parsedData).toHaveProperty('diaryEntries');
    // Diary history must be exported too
    expect(parsedData).toHaveProperty('diaryHistory');
    expect(parsedData.diaryHistory[0].content).toBe('Old version');

    expect(parsedData.annotations[0].content_markdown).toBe('Note 1');
    expect(parsedData.highlights[0].color).toBe('yellow');
    expect(parsedData.pendingHighlights[0].quote).toBe('test');
    expect(parsedData.diaryEntries[0].content).toBe('Diary text');
  });

  it('exports categoryOptions, categorySelections, questionSets, investigationResults in project.json', async () => {
    const mockAddFile = vi.fn();
    (globalThis as unknown).mockAddFile = mockAddFile;

    // Return distinct data for each new table
    mockdbAdapter.db.prepare = vi.fn((sql) => {
      if (sql.includes('FROM projects')) return { get: () => ({ id: 1, name: 'Test' }) };
      if (sql.includes('project_category_options')) return { all: () => [{ id: 10, category_id: 5, name: 'Opt A' }] };
      if (sql.includes('article_category_selections'))
        return { all: () => [{ article_id: 2, category_id: 5, option_id: 10 }] };
      if (sql.includes('question_sets'))
        return {
          all: () => [
            { id: 3, project_id: 1, name: 'QS1', description: null, questions: '[]', created_at: '', updated_at: '' },
          ],
        };
      if (sql.includes('investigation_results'))
        return {
          all: () => [
            {
              id: 7,
              investigation_id: 1,
              article_id: 2,
              question: 'Q?',
              answer: 'A',
              quote: null,
              status: 'success',
              error_message: null,
              created_at: '',
            },
          ],
        };
      return { all: () => [] };
    });

    const service = new SyncService(mockdbAdapter);
    await service.exportProject(1);

    const [, contentBuffer] = mockAddFile.mock.calls[0];
    const parsed = JSON.parse(contentBuffer.toString('utf-8'));

    expect(parsed).toHaveProperty('categoryOptions');
    expect(parsed.categoryOptions[0].name).toBe('Opt A');
    expect(parsed).toHaveProperty('categorySelections');
    expect(parsed.categorySelections[0].option_id).toBe(10);
    expect(parsed).toHaveProperty('questionSets');
    expect(parsed.questionSets[0].name).toBe('QS1');
    expect(parsed).toHaveProperty('investigationResults');
    expect(parsed.investigationResults[0].question).toBe('Q?');
  });

  describe('Full Backup & Restore', () => {
    it('exports backup successfully and checkpoints WAL before reading DB', async () => {
      const mockAddFile = vi.fn();
      const mockAddLocalFolder = vi.fn();
      const mockWriteZip = vi.fn();

      (globalThis as unknown).mockAddFile = mockAddFile;
      (globalThis as unknown).mockShowSaveDialog.mockResolvedValueOnce({
        canceled: false,
        filePath: '/tmp/backup.emmabak',
      });

      const mockPragma = vi.fn();
      // Mock database prepared queries for count
      mockdbAdapter.db.pragma = mockPragma;
      mockdbAdapter.db.prepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ count: 5 }),
      });

      const service = new SyncService(mockdbAdapter);
      const result = await service.exportBackup();

      expect(result).toBe('/tmp/backup.emmabak');
      expect(mockAddFile).toHaveBeenCalled();
      // Verify WAL checkpoint was called to ensure data consistency
      expect(mockPragma).toHaveBeenCalledWith('wal_checkpoint(TRUNCATE)');
      const metadataCall = mockAddFile.mock.calls.find((call: unknown) => call[0] === 'backup_metadata.json');
      expect(metadataCall).toBeDefined();
      const metadata = JSON.parse(metadataCall![1].toString('utf-8'));
      expect(metadata.projectCount).toBe(5);
    });

    it('returns null on export backup if canceled', async () => {
      (globalThis as unknown).mockShowSaveDialog.mockResolvedValueOnce({ canceled: true });
      const service = new SyncService(mockdbAdapter);
      const result = await service.exportBackup();
      expect(result).toBeNull();
    });

    it('restores backup override successfully and checkpoints WAL before close', async () => {
      const mockGetEntry = vi.fn().mockReturnValue({
        getData: () => Buffer.from('mock db data'),
      });
      (globalThis as unknown).mockGetEntry = mockGetEntry;

      const mockClose = vi.fn();
      const mockCheckpoint = vi.fn();
      mockdbAdapter.close = mockClose;
      mockdbAdapter.checkpoint = mockCheckpoint;

      const service = new SyncService(mockdbAdapter);
      const result = await service.restoreBackupOverride('/tmp/backup.emmabak');

      expect(result).toBe(true);
      expect(mockCheckpoint).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
      expect(app.relaunch).toHaveBeenCalled();
      expect(app.exit).toHaveBeenCalled();
    });

    it('returns false on restore backup override if canceled', async () => {
      (globalThis as unknown).mockShowOpenDialog.mockResolvedValueOnce({ canceled: true });
      const service = new SyncService(mockdbAdapter);
      const result = await service.restoreBackupOverride();
      expect(result).toBe(false);
    });
  });
});

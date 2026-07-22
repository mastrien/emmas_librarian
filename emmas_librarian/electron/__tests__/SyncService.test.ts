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

  it('imports project successfully', async () => {
    const service = new SyncService(mockdbAdapter);
    const result = await service.importProject();
    expect(result).toBe(10);
  });

  it('imports project with a provided path', async () => {
    const service = new SyncService(mockdbAdapter);
    const result = await service.importProject('/provided/path.emmapcarc');
    expect(result).toBe(10);
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

  it('imports project with articles, docs, and massive investigations data successfully', async () => {
    (globalThis as unknown).mockGetEntry.mockReturnValueOnce({
      getData: () =>
        Buffer.from(
          JSON.stringify({
            project: { name: 'Test' },
            articles: [{ id: 100, title: 'Art Title', local_file_path: '/old/art.pdf' }],
            searchHistory: [
              {
                unified_query: 'test',
                translated_queries: '{}',
                total_results: 1,
                results_breakdown: '{}',
                sort_by: 'relevance',
                limit_val: 20,
              },
            ],
            projectDocs: [{ title: 'Doc', local_file_path: '/old/doc.pdf' }],
            projCategories: [{ id: 50, name: 'Cat', type: 'text', options: '' }],
            articleCategories: [{ article_id: 100, category_id: 50, value: 'RCT' }],
            massiveInvs: [
              {
                created_at: '2026-06-03T12:00:00.000Z',
                status: 'Sucesso',
                model_used: 'model',
                questions: '[]',
                articles_ids: '[100]',
              },
            ],
          }),
        ),
    });

    const service = new SyncService(mockdbAdapter);
    const result = await service.importProject();
    expect(result).toBe(10);
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

  it('imports project with all fields: annotations, highlights, diary, diary history, and all article columns', async () => {
    const runSpy = vi.fn().mockReturnValue({ lastInsertRowid: 777 });
    mockdbAdapter.db.prepare = vi.fn().mockReturnValue({
      run: runSpy,
      all: vi.fn().mockReturnValue([]),
    });

    (globalThis as unknown).mockGetEntry.mockReturnValueOnce({
      getData: () =>
        Buffer.from(
          JSON.stringify({
            project: { name: 'Test', writing_pad: 'My notes', last_executed_at: '2026-01-01T00:00:00Z' },
            articles: [
              {
                id: 100,
                title: 'Art Title',
                doi: '10.1/test',
                authors: 'A; B',
                year: 2024,
                source_query: 'query',
                source_databases: 'pubmed',
                csl_json: '{}',
                status: 'included',
                archive_note: null,
                abstract: 'Abstract text',
                author_keywords: 'kw1',
                index_keywords: 'ik1',
                journal: 'J Nature',
                volume: '10',
                issue: '2',
                pages: '1-10',
                affiliations: 'Univ X',
                references_list: '[]',
                document_type: 'Article',
                issn: '1234-5678',
                citation_count: 42,
                ai_summary: 'AI summary',
                is_oa: 1,
                publisher: 'Springer',
                url: 'https://doi.org/test',
                accessed: '2026-06-05',
              },
            ],
            searchHistory: [],
            projectDocs: [],
            projCategories: [],
            articleCategories: [],
            massiveInvs: [],
            annotations: [{ id: 10, article_id: 100, content_markdown: 'Note 1', created_at: '2026-06-05' }],
            highlights: [
              {
                id: 20,
                article_id: 100,
                color: 'yellow',
                position_data: '{}',
                annotation_id: 10,
                content_text: 'text',
              },
            ],
            pendingHighlights: [
              {
                id: 30,
                article_id: 100,
                quote: 'test',
                context_before: '',
                context_after: '',
                comment: null,
                created_at: '2026-06-05',
              },
            ],
            diaryEntries: [{ id: 40, project_id: 99, entry_date: '2026-06-05', content: 'Diary text' }],
            diaryHistory: [
              {
                id: 50,
                project_id: 99,
                entry_date: '2026-06-05',
                content: 'Old version',
                updated_at: '2026-06-05T10:00:00',
              },
            ],
          }),
        ),
    });

    const service = new SyncService(mockdbAdapter);
    const result = await service.importProject();
    expect(result).toBe(777);

    const preparedSQLs = mockdbAdapter.db.prepare.mock.calls.map((c: unknown) => c[0]);
    // All entities must be inserted
    expect(preparedSQLs.some((sql: string) => sql.includes('INSERT INTO annotations'))).toBe(true);
    expect(preparedSQLs.some((sql: string) => sql.includes('INSERT INTO highlights'))).toBe(true);
    expect(preparedSQLs.some((sql: string) => sql.includes('INSERT INTO pending_highlights'))).toBe(true);
    expect(preparedSQLs.some((sql: string) => sql.includes('INSERT OR REPLACE INTO project_diary'))).toBe(true);
    // Diary history must also be imported
    expect(preparedSQLs.some((sql: string) => sql.includes('INSERT INTO project_diary_history'))).toBe(true);
    // Project must include writing_pad
    expect(preparedSQLs.some((sql: string) => sql.includes('writing_pad'))).toBe(true);
    // Articles must include all extended fields
    const artInsert = preparedSQLs.find((sql: string) => sql.includes('INSERT INTO articles'));
    expect(artInsert).toContain('abstract');
    expect(artInsert).toContain('ai_summary');
    expect(artInsert).toContain('is_oa');
    expect(artInsert).toContain('journal');
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

  it('imports categoryOptions, categorySelections, questionSets, and investigationResults with remapped IDs', async () => {
    const runSpy = vi.fn().mockReturnValue({ lastInsertRowid: 100 });
    mockdbAdapter.db.prepare = vi.fn().mockReturnValue({ run: runSpy, all: vi.fn().mockReturnValue([]) });

    (globalThis as unknown).mockGetEntry.mockReturnValueOnce({
      getData: () =>
        Buffer.from(
          JSON.stringify({
            project: { name: 'Test' },
            articles: [{ id: 1, title: 'Art', local_file_path: null }],
            searchHistory: [],
            projectDocs: [],
            projCategories: [{ id: 5, name: 'Cat', type: 'enum', options: '' }],
            categoryOptions: [{ id: 10, category_id: 5, name: 'Opt A' }],
            articleCategories: [],
            categorySelections: [{ article_id: 1, category_id: 5, option_id: 10 }],
            massiveInvs: [
              { id: 20, created_at: '', status: 'ok', model_used: '', questions: '[]', articles_ids: '[1]' },
            ],
            investigationResults: [
              {
                id: 30,
                investigation_id: 20,
                article_id: 1,
                question: 'Q?',
                answer: 'A',
                quote: null,
                status: 'success',
                error_message: null,
                created_at: '',
              },
            ],
            questionSets: [
              {
                id: 40,
                project_id: null,
                name: 'QS1',
                description: null,
                questions: '[]',
                created_at: '',
                updated_at: '',
              },
            ],
            annotations: [],
            highlights: [],
            pendingHighlights: [],
            diaryEntries: [],
            diaryHistory: [],
          }),
        ),
    });

    const service = new SyncService(mockdbAdapter);
    const result = await service.importProject();
    expect(result).toBe(100);

    const sqls = mockdbAdapter.db.prepare.mock.calls.map((c: unknown) => c[0]);
    expect(sqls.some((s: string) => s.includes('project_category_options'))).toBe(true);
    expect(sqls.some((s: string) => s.includes('article_category_selections'))).toBe(true);
    expect(sqls.some((s: string) => s.includes('investigation_results'))).toBe(true);
    expect(sqls.some((s: string) => s.includes('question_sets'))).toBe(true);
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

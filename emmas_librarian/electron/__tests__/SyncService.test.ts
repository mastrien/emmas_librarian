import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from '../database/SyncService';
import { dialog } from 'electron';
import fs from 'fs';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/userData')
  },
  dialog: {
    showSaveDialog: vi.fn().mockImplementation((...args) => (globalThis as any).mockShowSaveDialog(...args)),
    showOpenDialog: vi.fn().mockImplementation((...args) => (globalThis as any).mockShowOpenDialog(...args))
  }
}));

vi.mock('adm-zip', () => {
  const MockZip = vi.fn().mockImplementation(() => ({
    addFile: vi.fn(),
    addLocalFile: vi.fn(),
    writeZip: vi.fn(),
    getEntry: vi.fn().mockImplementation((...args) => (globalThis as any).mockGetEntry(...args))
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
  }
}));

describe('SyncService', () => {
  let mockDbManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
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
});

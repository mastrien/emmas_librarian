import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectSyncService } from '../ProjectSyncService';
import { dialog, app } from 'electron';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

vi.mock('electron', () => ({
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  },
  app: {
    getPath: vi.fn().mockReturnValue('/mocked/path'),
  },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    rmSync: vi.fn(),
  },
}));

const mockZipInstance = {
  addFile: vi.fn(),
  addLocalFile: vi.fn(),
  writeZip: vi.fn(),
  getEntry: vi.fn(),
  getEntries: vi.fn().mockReturnValue([]),
};

vi.mock('adm-zip', () => {
  return {
    default: vi.fn().mockImplementation(() => mockZipInstance),
  };
});

vi.mock('better-sqlite3', () => {
  const mockDb = {
    prepare: vi.fn(),
    exec: vi.fn(),
    transaction: vi.fn((cb) => cb),
  };
  return {
    default: vi.fn().mockImplementation(() => mockDb),
  };
});

vi.mock('crypto', () => ({
  default: {
    createHash: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        digest: vi.fn().mockReturnValue('mock-hash'),
      }),
    }),
  },
}));

vi.mock('uuid', () => ({ v4: vi.fn().mockReturnValue('uuid-v4') }));

const makeData = (overrides: any = {}) => ({
  project: { name: 'P' },
  articles: [],
  searchHistory: [],
  projectDocs: [],
  projCategories: [],
  categoryOptions: [],
  articleCategories: [],
  categorySelections: [],
  massiveInvs: [],
  investigationResults: [],
  questionSets: [],
  annotations: [],
  highlights: [],
  pendingHighlights: [],
  diaryEntries: [],
  diaryHistory: [],
  ...overrides,
});

describe('ProjectSyncService', () => {
  let mockDbAdapter: any;
  let service: ProjectSyncService;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      prepare: vi.fn(),
      exec: vi.fn(),
      transaction: vi.fn((cb) => cb),
    };

    mockDbAdapter = {
      getDB: () => mockDb,
    };

    service = new ProjectSyncService(mockDbAdapter);
  });

  describe('exportProject', () => {
    it('should return null if canceled', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true, filePath: 'some/path.emmapcarc' } as any);
      const res = await service.exportProject(1);
      expect(res).toBeNull();
    });

    it('should return null if filePath is empty or undefined', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: '' } as any);
      expect(await service.exportProject(1)).toBeNull();

      vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: undefined } as any);
      expect(await service.exportProject(1)).toBeNull();
    });

    it('should throw error if project not found', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: 'test.emmapcarc' });
      mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue(null) });
      await expect(service.exportProject(1)).rejects.toThrow('Projeto não encontrado');
    });

    it('should export project successfully', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: 'test.emmapcarc' });

      mockDb.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM projects WHERE id = ?')) {
          return { get: vi.fn().mockReturnValue({ id: 1, name: 'P' }) };
        }
        if (sql.includes('articles WHERE project_id = ?')) {
          return { all: vi.fn().mockReturnValue([{ id: 1, local_file_path: 'local.pdf' }]) };
        }
        if (sql.includes('project_documents WHERE project_id = ?')) {
          return { all: vi.fn().mockReturnValue([{ id: 1, file_path: 'doc.doc' }]) };
        }
        return { all: vi.fn().mockReturnValue([{ id: 1 }]) };
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);

      const res = await service.exportProject(123);
      expect(res).toBe('test.emmapcarc');
      expect(dialog.showSaveDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultPath: 'projeto_123.emmapcarc',
          filters: [{ name: "Emma's Librarian Project", extensions: ['emmapcarc'] }],
        }),
      );
    });

    it('should skip adding local file if local_file_path is missing/falsy', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: 'test.emmapcarc' });

      mockDb.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM projects WHERE id = ?')) {
          return { get: vi.fn().mockReturnValue({ id: 1, name: 'P' }) };
        }
        if (sql.includes('articles WHERE project_id = ?')) {
          return {
            all: vi.fn().mockReturnValue([
              { id: 1, local_file_path: '' },
              { id: 2, local_file_path: null },
            ]),
          };
        }
        if (sql.includes('project_documents WHERE project_id = ?')) {
          return {
            all: vi.fn().mockReturnValue([
              { id: 1, file_path: '' },
              { id: 2, file_path: null },
            ]),
          };
        }
        return { all: vi.fn().mockReturnValue([]) };
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);

      const res = await service.exportProject(1);
      expect(res).toBe('test.emmapcarc');
      expect(fs.existsSync).not.toHaveBeenCalled();
      expect(mockZipInstance.addLocalFile).not.toHaveBeenCalled();
    });

    it('should throw error if db fails', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: 'test.emmapcarc' });
      mockDb.prepare.mockImplementation(() => {
        throw new Error('DB error');
      });
      await expect(service.exportProject(1)).rejects.toThrow('DB error');
    });
  });

  describe('importProject', () => {
    it('should return null if canceled', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: ['some/path.emmapcarc'] });
      const res = await service.importProject();
      expect(res).toBeNull();
    });

    it('should return null if filePaths is empty', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [] });
      const res = await service.importProject();
      expect(res).toBeNull();
    });

    it('should throw error if missing project.json', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmapcarc'] });
      mockZipInstance.getEntry.mockReturnValue(undefined as any);

      await expect(service.importProject()).rejects.toThrow(
        'Arquivo de projeto inválido (.emmapcarc não contém project.json)',
      );
    });

    it('should throw error if db fails during import', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmapcarc'] });

      mockZipInstance.getEntry.mockImplementation((name: string) => {
        if (name === 'project.json') return { getData: () => Buffer.from(JSON.stringify(makeData())) } as any;
        return undefined as any;
      });

      mockDb.transaction = vi.fn().mockImplementation(() => {
        throw new Error('DB error');
      });

      await expect(service.importProject()).rejects.toThrow('DB error');
    });
  });
});

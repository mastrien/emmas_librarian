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
  }
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    rmSync: vi.fn(),
  }
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
    default: vi.fn().mockImplementation(() => mockZipInstance)
  };
});

vi.mock('better-sqlite3', () => {
  const mockDb = {
    prepare: vi.fn(),
    exec: vi.fn(),
    transaction: vi.fn((cb) => cb),
  };
  return {
    default: vi.fn().mockImplementation(() => mockDb)
  };
});

vi.mock('crypto', () => ({
  default: {
    createHash: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        digest: vi.fn().mockReturnValue('mock-hash')
      })
    })
  }
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
  ...overrides
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
      expect(dialog.showSaveDialog).toHaveBeenCalledWith(expect.objectContaining({
        defaultPath: 'projeto_123.emmapcarc',
        filters: [{ name: "Emma's Librarian Project", extensions: ['emmapcarc'] }],
      }));
    });

    it('should handle missing local files during export', async () => {
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
        return { all: vi.fn().mockReturnValue([]) };
      });

      vi.mocked(fs.existsSync).mockReturnValue(false); // files don't exist

      const res = await service.exportProject(1);
      expect(res).toBe('test.emmapcarc');
      expect(fs.existsSync).toHaveBeenCalledWith('local.pdf');
      expect(fs.existsSync).toHaveBeenCalledWith('doc.doc');
      expect(mockZipInstance.addLocalFile).not.toHaveBeenCalled();
    });

    it('should skip adding local file if local_file_path is missing/falsy', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: 'test.emmapcarc' });
      
      mockDb.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM projects WHERE id = ?')) {
          return { get: vi.fn().mockReturnValue({ id: 1, name: 'P' }) };
        }
        if (sql.includes('articles WHERE project_id = ?')) {
          return { all: vi.fn().mockReturnValue([{ id: 1, local_file_path: '' }, { id: 2, local_file_path: null }]) };
        }
        if (sql.includes('project_documents WHERE project_id = ?')) {
          return { all: vi.fn().mockReturnValue([{ id: 1, file_path: '' }, { id: 2, file_path: null }]) };
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
      mockDb.prepare.mockImplementation(() => { throw new Error('DB error'); });
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

    it('should skip dialog if providedPath is passed', async () => {
      mockZipInstance.getEntry.mockReturnValue({ getData: () => Buffer.from(JSON.stringify(makeData())) } as any);
      mockDb.prepare.mockReturnValue({ run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }) });
      
      const newPid = await service.importProject('custom/path.emmapcarc');
      expect(newPid).toBe(1);
      expect(dialog.showOpenDialog).not.toHaveBeenCalled();
    });

    it('should throw error if missing project.json', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmapcarc'] });
      mockZipInstance.getEntry.mockReturnValue(undefined as any);

      await expect(service.importProject()).rejects.toThrow('Arquivo de projeto inválido (.emmapcarc não contém project.json)');
    });

    it('should import project successfully', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmapcarc'] });
      
      const data = {
        project: { name: 'Imp Proj', writing_pad: 'pad', last_executed_at: '' }, // empty string triggers || null
        articles: [{ id: 1, title: 'Imp Art', local_file_path: 'C:/fake/pdf.pdf' }],
        searchHistory: [{ id: 1, unified_query: 'Q' }],
        projectDocs: [{ id: 1, title: 'Doc', local_file_path: 'C:/fake/doc.doc' }],
        projCategories: [{ id: 1, name: 'Cat' }],
        categoryOptions: [{ id: 1, category_id: 1, name: 'Opt' }],
        articleCategories: [{ article_id: 1, category_id: 1, value: 'Val' }],
        categorySelections: [{ article_id: 1, category_id: 1, option_id: 1 }],
        massiveInvs: [{ id: 1, created_at: '2023', status: 'done', model_used: 'm', questions: 'q', articles_ids: '[1]' }],
        investigationResults: [{ investigation_id: 1, article_id: 1, question: 'q', status: 'success' }],
        questionSets: [{ name: 'QS', questions: 'q' }],
        annotations: [{ id: 1, article_id: 1, content_markdown: 'Ann' }],
        highlights: [{ article_id: 1, annotation_id: 1, color: '#000' }],
        pendingHighlights: [{ article_id: 1, quote: 'Q' }],
        diaryEntries: [{ entry_date: '2023', content: 'D' }],
        diaryHistory: [{ entry_date: '2023', content: 'DH' }]
      };

      mockZipInstance.getEntry.mockImplementation((name: string) => {
        if (name === 'project.json') return { getData: () => Buffer.from(JSON.stringify(data)) } as any;
        if (name.includes('pdf')) return { getData: () => Buffer.from('pdf content') } as any;
        if (name.includes('doc')) return { getData: () => Buffer.from('doc content') } as any;
        return undefined as any;
      });

      const runSpy = vi.fn().mockReturnValue({ lastInsertRowid: 1 });
      mockDb.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT file_path FROM pdf_files')) {
          return { get: vi.fn().mockReturnValue(null) };
        }
        return { run: runSpy };
      });
      
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const newPid = await service.importProject();
      expect(newPid).toBe(1);
      
      const insertProjCall = mockDb.prepare.mock.calls.find(c => c[0].includes('INSERT INTO projects'));
      expect(insertProjCall).toBeDefined();
      
      const insertProjRunCall = runSpy.mock.calls.find(c => c[0] === 'Imp Proj (Importado)');
      expect(insertProjRunCall).toBeDefined();
      // args: name, created_at, last_executed_at, writing_pad
      expect(insertProjRunCall[2]).toBe(null); // last_executed_at
      expect(insertProjRunCall[3]).toBe('pad'); // writing_pad

      expect(dialog.showOpenDialog).toHaveBeenCalledWith(expect.objectContaining({
        filters: [{ name: "Emma's Librarian Project", extensions: ['emmapcarc'] }],
      }));
    });

    it('should reuse existing pdf if file_hash matches', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmapcarc'] });
      
      const data = makeData({
        project: { name: 'Imp Proj Reuse' },
        articles: [{ id: 1, local_file_path: 'C:/fake/reuse.pdf' }],
      });
      
      mockZipInstance.getEntry.mockImplementation((name: string) => {
        if (name === 'project.json') return { getData: () => Buffer.from(JSON.stringify(data)) } as any;
        if (name.includes('pdf')) return { getData: () => Buffer.from('pdf content') } as any;
        return undefined as any;
      });

      mockDb.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT file_path FROM pdf_files')) {
          return { get: vi.fn().mockReturnValue({ file_path: 'existing.pdf' }) };
        }
        return { run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }) };
      });
      
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const newPid = await service.importProject();
      expect(newPid).toBe(1);
    });

    it('should not copy pdfs or docs if zip entry is missing', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmapcarc'] });
      
      const data = makeData({
        project: { name: 'Imp Proj 2' },
        articles: [{ id: 1, local_file_path: 'C:/fake/missing.pdf' }],
        projectDocs: [{ id: 1, local_file_path: 'C:/fake/missing.doc' }],
      });
      
      mockZipInstance.getEntry.mockImplementation((name: string) => {
        if (name === 'project.json') return { getData: () => Buffer.from(JSON.stringify(data)) } as any;
        return undefined as any; // No pdf or doc
      });

      mockDb.prepare = vi.fn().mockReturnValue({ run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }) });

      const newPid = await service.importProject();
      expect(newPid).toBe(1);
    });

    it('should gracefully handle malformed articles_ids in massiveInvs during import', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmapcarc'] });
      
      const data = makeData({
        project: { name: 'Imp Proj 3' },
        massiveInvs: [{ id: 1, articles_ids: 'not_json' }],
      });
      
      mockZipInstance.getEntry.mockImplementation((name: string) => {
        if (name === 'project.json') return { getData: () => Buffer.from(JSON.stringify(data)) } as any;
        return undefined as any;
      });

      mockDb.prepare = vi.fn().mockReturnValue({ run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }) });

      const newPid = await service.importProject();
      expect(newPid).toBe(1);
    });

    it('should ignore duplicate pk error for article_category_selections', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmapcarc'] });
      
      const data = makeData({
        project: { name: 'Imp Proj Dup' },
        articles: [{ id: 1 }],
        projCategories: [{ id: 1, name: 'Cat' }],
        categoryOptions: [{ id: 1, category_id: 1, name: 'Opt' }],
        categorySelections: [
          { article_id: 1, category_id: 1, option_id: 1 },
          { article_id: 1, category_id: 1, option_id: 1 }, // duplicate
        ]
      });
      
      mockZipInstance.getEntry.mockImplementation((name: string) => {
        if (name === 'project.json') return { getData: () => Buffer.from(JSON.stringify(data)) } as any;
        return undefined as any;
      });

      let callCount = 0;
      mockDb.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('article_category_selections')) {
          return {
            run: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount > 1) throw new Error('duplicate pk');
              return { lastInsertRowid: 1 };
            })
          };
        }
        return { run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }) };
      });

      const newPid = await service.importProject();
      expect(newPid).toBe(1);
    });

    it('should throw error if db fails during import', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmapcarc'] });
      
      mockZipInstance.getEntry.mockImplementation((name: string) => {
        if (name === 'project.json') return { getData: () => Buffer.from(JSON.stringify(makeData())) } as any;
        return undefined as any;
      });

      mockDb.transaction = vi.fn().mockImplementation(() => { throw new Error('DB error'); });

      await expect(service.importProject()).rejects.toThrow('DB error');
    });
  });
});

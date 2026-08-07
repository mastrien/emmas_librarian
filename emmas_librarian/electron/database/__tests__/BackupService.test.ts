import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BackupService } from '../BackupService';
import { dialog, app } from 'electron';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';

vi.mock('electron', () => ({
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  },
  app: {
    getPath: vi.fn().mockReturnValue('/mocked/path'),
    getVersion: vi.fn().mockReturnValue('1.0.0'),
    relaunch: vi.fn(),
    exit: vi.fn(),
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
  addLocalFolder: vi.fn(),
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
    pragma: vi.fn().mockReturnValue([{ name: 'options' }, { name: 'model_used' }, { name: 'status' }, { name: 'content_text' }]),
    prepare: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue({ count: 1, id: 1 }),
      all: vi.fn().mockReturnValue([]),
      run: vi.fn().mockReturnValue({ lastInsertRowid: 1 })
    }),
    exec: vi.fn(),
    close: vi.fn(),
    transaction: vi.fn((cb) => cb),
  };
  return {
    default: vi.fn().mockImplementation(() => mockDb)
  };
});

vi.mock('uuid', () => ({ v4: vi.fn().mockReturnValue('uuid-v4') }));

describe('BackupService', () => {
  let mockDbAdapter: any;
  let backupService: BackupService;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDb = new Database(':memory:');
    mockDbAdapter = {
      getDB: () => mockDb,
      checkpoint: vi.fn(),
      close: vi.fn(),
    };

    backupService = new BackupService(mockDbAdapter);
  });

  describe('exportBackup', () => {
    it('should return null if dialog is canceled', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true } as any);
      const res = await backupService.exportBackup();
      expect(res).toBeNull();
    });

    it('should export backup successfully and handle missing directories', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: 'test.emmabak' });
      vi.mocked(fs.existsSync).mockReturnValue(false); // missing db and dirs
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('db'));

      const res = await backupService.exportBackup();
      expect(res).toBe('test.emmabak');
    });

    it('should handle errors in export', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: 'test.emmabak' });
      vi.mocked(fs.existsSync).mockImplementation(() => { throw new Error('Export error'); });
      await expect(backupService.exportBackup()).rejects.toThrow('Export error');
    });
  });

  describe('restoreBackupOverride', () => {
    it('should return false if dialog is canceled', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] });
      const res = await backupService.restoreBackupOverride();
      expect(res).toBe(false);
    });

    it('should restore backup successfully', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmabak'] });
      
      mockZipInstance.getEntry.mockReturnValue({ getData: () => Buffer.from('db') } as any);
      mockZipInstance.getEntries.mockReturnValue([
        { entryName: 'storage/pdfs/test.pdf', isDirectory: false, getData: () => Buffer.from('pdf') },
        { entryName: 'storage/project_documents/test.doc', isDirectory: false, getData: () => Buffer.from('doc') },
        { entryName: 'other/', isDirectory: true, getData: () => Buffer.from('') },
      ] as any);

      vi.mocked(fs.existsSync).mockReturnValue(true);

      const res = await backupService.restoreBackupOverride();
      expect(res).toBe(true);
      expect(mockDbAdapter.checkpoint).toHaveBeenCalled();
      expect(mockDbAdapter.close).toHaveBeenCalled();
      expect(app.relaunch).toHaveBeenCalled();
      expect(app.exit).toHaveBeenCalledWith(0);
    });

    it('should restore backup successfully when dirs are missing and wal/shm do not exist', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmabak'] });
      
      mockZipInstance.getEntry.mockReturnValue({ getData: () => Buffer.from('db') } as any);
      mockZipInstance.getEntries.mockReturnValue([
        { entryName: 'storage/pdfs/test.pdf', isDirectory: false, getData: () => Buffer.from('pdf') },
        { entryName: 'storage/project_documents/test.doc', isDirectory: false, getData: () => Buffer.from('doc') },
      ] as any);

      vi.mocked(fs.existsSync).mockReturnValue(false); // wal/shm false, destDir false

      const res = await backupService.restoreBackupOverride();
      expect(res).toBe(true);
      expect(fs.mkdirSync).toHaveBeenCalledTimes(2);
    });

    it('should throw error if invalid zip (no emma.db)', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmabak'] });
      mockZipInstance.getEntry.mockReturnValue(undefined as any);
      await expect(backupService.restoreBackupOverride()).rejects.toThrow('Arquivo de backup inválido (não contém emma.db)');
    });
  });

  describe('restoreBackupMerge', () => {
    it('should return 0 if dialog is canceled', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] });
      const res = await backupService.restoreBackupMerge();
      expect(res).toBe(0);
    });

    it('should merge backup successfully and hit missing dir branches', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmabak'] });
      
      mockZipInstance.getEntry.mockImplementation((name: string) => {
        if (name === 'emma.db') return { getData: () => Buffer.from('db') } as any;
        if (name.includes('pdfs')) return { getData: () => Buffer.from('pdf') } as any;
        if (name.includes('documents')) return { getData: () => Buffer.from('doc') } as any;
        return undefined as any;
      });

      let callCount = 0;
      mockDb.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT name FROM projects WHERE deleted_at IS NULL')) {
          return { all: () => [{ name: 'Existing Proj' }] };
        }
        if (sql.includes('SELECT * FROM projects WHERE deleted_at IS NULL')) {
          return { all: () => [{ id: 1, name: 'New Proj', created_at: '2023' }] };
        }
        if (sql.includes('SELECT * FROM articles WHERE project_id = ?')) {
          return { all: () => [{ id: 1, title: 'Art', local_file_path: 'local.pdf' }] };
        }
        if (sql.includes('SELECT * FROM search_history')) return { all: () => [{ id: 1 }] };
        if (sql.includes('SELECT * FROM project_documents')) return { all: () => [{ id: 1, local_file_path: 'doc.doc' }] };
        if (sql.includes('SELECT * FROM massive_investigations')) return { all: () => [{ id: 1, articles_ids: '[1]' }] };
        if (sql.includes('SELECT * FROM project_categories')) return { all: () => [{ id: 1 }] };
        if (sql.includes('SELECT ac.* FROM article_categories')) return { all: () => [{ article_id: 1, category_id: 1 }] };
        if (sql.includes('SELECT a.* FROM annotations')) return { all: () => [{ id: 1, article_id: 1 }] };
        if (sql.includes('SELECT h.* FROM highlights')) return { all: () => [{ id: 1, article_id: 1, annotation_id: 1 }] };
        if (sql.includes('SELECT ph.* FROM pending_highlights')) return { all: () => [{ id: 1, article_id: 1 }] };
        if (sql.includes('SELECT * FROM project_diary')) return { all: () => [{ id: 1 }] };
        
        return { 
          run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
          get: vi.fn().mockReturnValue({ id: 1 }),
          all: vi.fn().mockReturnValue([])
        };
      });

      vi.mocked(fs.existsSync).mockReturnValue(false); // Trigger missing dir branches

      const res = await backupService.restoreBackupMerge();
      expect(res).toBe(1);
    });

    it('should ignore duplicate project names', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmabak'] });
      
      mockZipInstance.getEntry.mockReturnValue({ getData: () => Buffer.from('db') } as any);

      mockDb.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT name FROM projects WHERE deleted_at IS NULL')) {
          return { all: () => [{ name: 'Same Proj' }] };
        }
        if (sql.includes('SELECT * FROM projects WHERE deleted_at IS NULL')) {
          return { all: () => [{ id: 1, name: 'Same Proj' }] }; // will be skipped
        }
        return { run: vi.fn(), get: vi.fn(), all: vi.fn().mockReturnValue([]) };
      });

      const res = await backupService.restoreBackupMerge();
      expect(res).toBe(0);
    });

    it('should handle tempDb exceptions gracefully', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmabak'] });
      mockZipInstance.getEntry.mockReturnValue({ getData: () => Buffer.from('db') } as any);
      
      mockDb.exec = vi.fn().mockImplementation(() => { throw new Error('exec error'); });
      mockDb.pragma = vi.fn().mockImplementation(() => { throw new Error('pragma error'); });
      
      mockDb.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('ALTER TABLE')) throw new Error('alter error');
        if (sql.includes('SELECT * FROM projects')) return { all: () => [] };
        return { run: vi.fn(), get: vi.fn(), all: vi.fn().mockReturnValue([]) };
      });

      const res = await backupService.restoreBackupMerge();
      expect(res).toBe(0);
    });
    
    it('should throw error if invalid zip (no emma.db)', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmabak'] });
      mockZipInstance.getEntry.mockReturnValue(undefined as any);
      await expect(backupService.restoreBackupMerge()).rejects.toThrow('Arquivo de backup inválido (não contém emma.db)');
    });

    it('should handle temp cleanup errors', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['test.emmabak'] });
      
      mockZipInstance.getEntry.mockReturnValue({ getData: () => Buffer.from('db') } as any);

      mockDb.prepare = vi.fn().mockImplementation(() => {
        return { run: vi.fn(), get: vi.fn(), all: vi.fn().mockReturnValue([]) };
      });
      mockDb.close = vi.fn().mockImplementation(() => { throw new Error('close error'); });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.rmSync).mockImplementation(() => { throw new Error('rmSync error'); });

      const res = await backupService.restoreBackupMerge();
      expect(res).toBe(0);
    });
  });
});

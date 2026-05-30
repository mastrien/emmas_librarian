import { describe, it, expect, vi } from 'vitest';
import { SyncService } from '../database/SyncService';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/path')
  },
  dialog: {
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/test.emmapcarc' }),
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/tmp/test.emmapcarc'] })
  }
}));

vi.mock('adm-zip', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      addFile: vi.fn(),
      addLocalFile: vi.fn(),
      writeZip: vi.fn(),
      getEntry: vi.fn().mockReturnValue({
        getData: () => Buffer.from(JSON.stringify({
          project: { name: 'Test' },
          articles: [],
          searchHistory: [],
          projectDocs: [],
          massiveInvs: [],
          projCategories: [],
          articleCategories: []
        }))
      })
    }))
  };
});

describe('SyncService', () => {
  it('exports a project successfully', async () => {
    const mockDbManager = {
      db: {
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ id: 1, name: 'Test' }),
          all: vi.fn().mockReturnValue([])
        })
      }
    };
    
    const service = new SyncService(mockDbManager as any);
    const result = await service.exportProject(1);
    expect(result).toBe('/tmp/test.emmapcarc');
  });

  it('imports a project successfully', async () => {
    let mockTransactionFn: any;
    const mockDbManager = {
      db: {
        transaction: vi.fn((fn) => {
          mockTransactionFn = fn;
          return fn;
        }),
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ lastInsertRowid: 10 })
        })
      },
      storageDir: '/tmp'
    };
    
    const service = new SyncService(mockDbManager as any);
    const result = await service.importProject();
    expect(result).toBe(10);
  });
});

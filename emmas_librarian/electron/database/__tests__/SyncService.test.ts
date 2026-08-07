import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncService } from '../SyncService';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { ProjectSyncService } from '../ProjectSyncService';
import { BackupService } from '../BackupService';

vi.mock('../ProjectSyncService');
vi.mock('../BackupService');

describe('SyncService', () => {
  let syncService: SyncService;
  let mockDbAdapter: DatabaseAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAdapter = {} as DatabaseAdapter;
    syncService = new SyncService(mockDbAdapter);
  });

  it('should call ProjectSyncService.exportProject', async () => {
    const mockExportProject = vi.fn().mockResolvedValue('test/path');
    vi.mocked(ProjectSyncService.prototype.exportProject).mockImplementation(mockExportProject);

    const result = await syncService.exportProject(1);
    expect(mockExportProject).toHaveBeenCalledWith(1);
    expect(result).toBe('test/path');
  });

  it('should call ProjectSyncService.importProject', async () => {
    const mockImportProject = vi.fn().mockResolvedValue(1);
    vi.mocked(ProjectSyncService.prototype.importProject).mockImplementation(mockImportProject);

    const result = await syncService.importProject('test/path');
    expect(mockImportProject).toHaveBeenCalledWith('test/path');
    expect(result).toBe(1);
  });

  it('should call BackupService.exportBackup', async () => {
    const mockExportBackup = vi.fn().mockResolvedValue('test/path');
    vi.mocked(BackupService.prototype.exportBackup).mockImplementation(mockExportBackup);

    const result = await syncService.exportBackup();
    expect(mockExportBackup).toHaveBeenCalled();
    expect(result).toBe('test/path');
  });

  it('should call BackupService.restoreBackupOverride', async () => {
    const mockRestoreBackupOverride = vi.fn().mockResolvedValue(true);
    vi.mocked(BackupService.prototype.restoreBackupOverride).mockImplementation(mockRestoreBackupOverride);

    const result = await syncService.restoreBackupOverride('test/path');
    expect(mockRestoreBackupOverride).toHaveBeenCalledWith('test/path');
    expect(result).toBe(true);
  });

  it('should call BackupService.restoreBackupMerge', async () => {
    const mockRestoreBackupMerge = vi.fn().mockResolvedValue(1);
    vi.mocked(BackupService.prototype.restoreBackupMerge).mockImplementation(mockRestoreBackupMerge);

    const result = await syncService.restoreBackupMerge('test/path');
    expect(mockRestoreBackupMerge).toHaveBeenCalledWith('test/path');
    expect(result).toBe(1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupService } from '../services/BackupService';
import fs from 'fs';
import path from 'path';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/userData'),
    relaunch: vi.fn(),
    exit: vi.fn(),
  },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    statSync: vi.fn(),
  },
}));

vi.mock('zlib', () => {
  const mockGzip = vi.fn().mockReturnValue(Buffer.from('compressed_db_data'));
  const mockGunzip = vi.fn().mockReturnValue(Buffer.from('decompressed_db_data'));
  return {
    gzipSync: mockGzip,
    gunzipSync: mockGunzip,
    default: {
      gzipSync: mockGzip,
      gunzipSync: mockGunzip,
    },
  };
});

describe('BackupService', () => {
  let mockdbAdapter: unknown;
  const backupsDir = '/mock/userData/backups';
  const dbPath = '/mock/userData/emma.db';

  beforeEach(() => {
    vi.clearAllMocks();

    mockdbAdapter = {
      checkIntegrity: vi.fn().mockReturnValue(true),
      getSetting: vi.fn().mockReturnValue('true'), // Auto-backups enabled by default
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([]);
  });

  it('skips auto backup if disabled in settings', async () => {
    mockdbAdapter.getSetting.mockReturnValueOnce('false');
    const manager = new BackupService(mockdbAdapter, dbPath, backupsDir);
    const result = await manager.runAutoBackup();
    expect(result).toBeNull();
    expect(mockdbAdapter.checkIntegrity).not.toHaveBeenCalled();
  });

  it('skips auto backup if backup already exists for today', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    vi.mocked(fs.readdirSync).mockReturnValue([`emma_backup_${todayStr}.db.gz` as unknown]);
    const manager = new BackupService(mockdbAdapter, dbPath, backupsDir);
    const result = await manager.runAutoBackup();
    expect(result).toBeNull();
    expect(mockdbAdapter.checkIntegrity).not.toHaveBeenCalled();
  });

  it('throws error or returns null and skips backup if database is corrupted', async () => {
    mockdbAdapter.checkIntegrity.mockReturnValueOnce(false);
    const manager = new BackupService(mockdbAdapter, dbPath, backupsDir);
    await expect(manager.runAutoBackup()).rejects.toThrow('Database integrity check failed');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('creates compressed backup successfully if database is healthy', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('sqlite_binary_data'));
    const manager = new BackupService(mockdbAdapter, dbPath, backupsDir);
    const result = await manager.runAutoBackup();

    expect(result).toContain('emma_backup_');
    expect(result).toContain('.db.gz');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('rotates backups correctly based on GFS retention policy', () => {
    // We mock files from various dates:
    // - Today: 2026-06-05
    // - Dailies (last 7 days): 2026-06-04, 2026-06-03, 2026-06-02, 2026-06-01, 2026-05-31, 2026-05-30
    // - Weeklies (newest of last 4 weeks): 2026-05-24 (week 21), 2026-05-17 (week 20), 2026-05-10 (week 19), 2026-05-03 (week 18)
    // - Monthlies (newest of last 12 months): 2026-04-30, 2026-03-31, 2026-02-28, 2026-01-31, 2025-12-31, 2025-11-30, 2025-10-31
    // - File to delete (old and doesn't match weekly/monthly): 2026-05-15 (middle of week 20, older than 7 days, not the newest of its week/month)
    const files = [
      'emma_backup_2026-06-05.db.gz', // keep (today)
      'emma_backup_2026-06-04.db.gz', // keep (daily)
      'emma_backup_2026-06-03.db.gz', // keep (daily)
      'emma_backup_2026-05-24.db.gz', // keep (weekly newest of week 21)
      'emma_backup_2026-05-15.db.gz', // delete (week 20, but 2026-05-17 is newer)
      'emma_backup_2026-05-17.db.gz', // keep (weekly newest of week 20)
      'emma_backup_2026-04-30.db.gz', // keep (monthly newest of April)
      'emma_backup_2026-04-10.db.gz', // delete (April, but 2026-04-30 is newer)
      'random_file.txt', // ignore (don't delete, not a backup)
    ];

    vi.mocked(fs.readdirSync).mockReturnValue(files as unknown);
    const manager = new BackupService(mockdbAdapter, dbPath, backupsDir);

    // Set system time to 2026-06-05
    const refDate = new Date('2026-06-05T12:00:00.000Z');
    manager.rotateBackups(refDate);

    // Verify deletion of non-compliant backups:
    // Should unlink: emma_backup_2026-05-15.db.gz and emma_backup_2026-04-10.db.gz
    const unlinkedFiles = vi.mocked(fs.unlinkSync).mock.calls.map((call) => path.basename(call[0] as string));
    expect(unlinkedFiles).toContain('emma_backup_2026-05-15.db.gz');
    expect(unlinkedFiles).toContain('emma_backup_2026-04-10.db.gz');
    expect(unlinkedFiles).not.toContain('emma_backup_2026-06-05.db.gz');
    expect(unlinkedFiles).not.toContain('emma_backup_2026-06-04.db.gz');
    expect(unlinkedFiles).not.toContain('emma_backup_2026-06-03.db.gz');
    expect(unlinkedFiles).not.toContain('emma_backup_2026-05-24.db.gz');
    expect(unlinkedFiles).not.toContain('emma_backup_2026-05-17.db.gz');
    expect(unlinkedFiles).not.toContain('emma_backup_2026-04-30.db.gz');
    expect(unlinkedFiles).not.toContain('random_file.txt');
  });

  it('lists automatic GFS backups correctly sorted', () => {
    const files = ['emma_backup_2026-06-04.db.gz', 'emma_backup_2026-06-05.db.gz', 'random_file.txt'];
    vi.mocked(fs.readdirSync).mockReturnValue(files as unknown);
    vi.mocked(fs.statSync).mockReturnValue({ size: 10240, mtime: new Date() } as unknown);

    const manager = new BackupService(mockdbAdapter, dbPath, backupsDir);
    const list = manager.listAutoBackups();

    expect(list).toHaveLength(2);
    expect(list[0].filename).toBe('emma_backup_2026-06-05.db.gz');
    expect(list[0].sizeBytes).toBe(10240);
  });

  it('restores automatic GFS backup successfully', () => {
    const mockClose = vi.fn();
    mockdbAdapter.close = mockClose;
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const manager = new BackupService(mockdbAdapter, dbPath, backupsDir);
    const result = manager.restoreAutoBackup('emma_backup_2026-06-05.db.gz');

    expect(result).toBe(true);
    expect(mockClose).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(dbPath, expect.any(Buffer));
  });
});

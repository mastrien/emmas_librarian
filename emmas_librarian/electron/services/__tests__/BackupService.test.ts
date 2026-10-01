// Real SQLite files, real gzip and a temp folder: the mocked fs/zlib version of this suite could not see what
// the backup actually contained. Node environment because better-sqlite3 and zlib need real Buffers.
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { gunzipSync, gzipSync } from 'zlib';

const electronApp = vi.hoisted(() => ({ relaunch: vi.fn(), exit: vi.fn() }));
vi.mock('electron', () => ({ safeStorage: {}, app: electronApp }));

import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { BackupService } from '../BackupService';

let workDir: string;
let dbPath: string;
let backupsDir: string;
let adapter: DatabaseAdapter;

const service = (db: DatabaseAdapter = adapter) => new BackupService(db, dbPath, backupsDir);
const addProject = (name: string) => adapter.getDB().prepare('INSERT INTO projects (name) VALUES (?)').run(name);
const backupFiles = () => (fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir).sort() : []);

/** Project names stored in a database file (opened read-only, outside the app's adapter). */
function projectNamesIn(file: string): string[] {
  const db = new Database(file, { readonly: true });
  try {
    return (db.prepare('SELECT name FROM projects ORDER BY name').all() as { name: string }[]).map((p) => p.name);
  } finally {
    db.close();
  }
}

function writeBackupFiles(names: string[]): void {
  fs.mkdirSync(backupsDir, { recursive: true });
  for (const name of names) fs.writeFileSync(path.join(backupsDir, name), name);
}

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-autobackup-'));
  dbPath = path.join(workDir, 'emma.db');
  backupsDir = path.join(workDir, 'backups');
  adapter = new DatabaseAdapter(dbPath);
});

afterEach(() => {
  try {
    adapter.close();
  } catch {
    // Restore tests close the adapter themselves.
  }
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('BackupService.runAutoBackup', () => {
  it('does nothing when automatic backups are turned off', async () => {
    adapter.setSetting('enable_auto_backups', 'false');

    expect(await service().runAutoBackup()).toBeNull();

    expect(backupFiles()).toEqual([]);
  });

  it('keeps the backup already made today instead of writing another', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 26, 10, 0));
    writeBackupFiles(['emma_backup_2026-09-26.db.gz']);

    expect(await service().runAutoBackup()).toBeNull();

    expect(fs.readFileSync(path.join(backupsDir, 'emma_backup_2026-09-26.db.gz'), 'utf8')).toBe(
      'emma_backup_2026-09-26.db.gz',
    );
  });

  // At 22:00 in UTC-3 the UTC date is already the 27th; the backup name must use the local day.
  it('names the backup after the local day late in the evening', async () => {
    vi.stubEnv('TZ', 'America/Sao_Paulo');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 26, 22, 0));

    const file = await service().runAutoBackup();

    expect(file).toBe(path.join(backupsDir, 'emma_backup_2026-09-26.db.gz'));
    expect(backupFiles()).toEqual(['emma_backup_2026-09-26.db.gz']);
  });

  it('refuses to back up a database that fails the integrity check', async () => {
    vi.spyOn(adapter, 'checkIntegrity').mockReturnValue(false);

    await expect(service().runAutoBackup()).rejects.toThrow('Database integrity check failed');

    expect(backupFiles()).toEqual([]);
  });

  it('writes a gzip copy of the database that opens with its projects', async () => {
    addProject('Tese');
    adapter.checkpoint();

    const file = await service().runAutoBackup();

    const copy = path.join(workDir, 'copy.db');
    fs.writeFileSync(copy, gunzipSync(fs.readFileSync(file!)));
    expect(projectNamesIn(copy)).toEqual(['Tese']);
  });

  // In WAL mode the latest writes live in emma.db-wal until a checkpoint; copying emma.db alone lost them
  // (a fresh library's backup had no tables at all).
  it('includes changes that are still only in the write-ahead log', async () => {
    addProject('Recente');

    const file = await service().runAutoBackup();

    const copy = path.join(workDir, 'copy.db');
    fs.writeFileSync(copy, gunzipSync(fs.readFileSync(file!)));
    expect(projectNamesIn(copy)).toEqual(['Recente']);
  });
});

describe('BackupService.rotateBackups (grandfather-father-son)', () => {
  it('keeps the last 7 days, the newest of the last 4 weeks and of the last 12 months', () => {
    writeBackupFiles([
      'emma_backup_2026-06-05.db.gz', // today
      'emma_backup_2026-06-04.db.gz', // daily
      'emma_backup_2026-06-03.db.gz', // daily
      'emma_backup_2026-05-24.db.gz', // newest of week 21
      'emma_backup_2026-05-17.db.gz', // newest of week 20
      'emma_backup_2026-05-15.db.gz', // week 20, older than the 17th → deleted
      'emma_backup_2026-04-30.db.gz', // newest of April
      'emma_backup_2026-04-10.db.gz', // April, older than the 30th → deleted
      'random_file.txt', // not a backup → untouched
    ]);

    service().rotateBackups(new Date('2026-06-05T12:00:00.000Z'));

    expect(backupFiles()).toEqual([
      'emma_backup_2026-04-30.db.gz',
      'emma_backup_2026-05-17.db.gz',
      'emma_backup_2026-05-24.db.gz',
      'emma_backup_2026-06-03.db.gz',
      'emma_backup_2026-06-04.db.gz',
      'emma_backup_2026-06-05.db.gz',
      'random_file.txt',
    ]);
  });

  it('does nothing when the backups folder does not exist yet', () => {
    expect(() => service().rotateBackups()).not.toThrow();

    expect(fs.existsSync(backupsDir)).toBe(false);
  });
});

describe('BackupService.listAutoBackups', () => {
  it('lists only backups, newest first, with their size on disk', () => {
    writeBackupFiles(['emma_backup_2026-06-04.db.gz', 'emma_backup_2026-06-05.db.gz', 'random_file.txt']);

    expect(service().listAutoBackups()).toEqual([
      { filename: 'emma_backup_2026-06-05.db.gz', date: '2026-06-05', sizeBytes: 28 },
      { filename: 'emma_backup_2026-06-04.db.gz', date: '2026-06-04', sizeBytes: 28 },
    ]);
  });

  it('returns an empty list when no backup was ever made', () => {
    expect(service().listAutoBackups()).toEqual([]);
  });
});

describe('BackupService.restoreAutoBackup', () => {
  /** An automatic backup of a separate library whose only project is `name`. */
  function writeAutoBackupOf(name: string): string {
    const otherPath = path.join(workDir, 'other.db');
    const other = new DatabaseAdapter(otherPath);
    other.getDB().prepare('INSERT INTO projects (name) VALUES (?)').run(name);
    other.checkpoint();
    other.close();
    fs.mkdirSync(backupsDir, { recursive: true });
    const filename = 'emma_backup_2026-06-01.db.gz';
    fs.writeFileSync(path.join(backupsDir, filename), gzipSync(fs.readFileSync(otherPath)));
    return filename;
  }

  it('replaces the database with the backup, drops the old WAL and restarts', () => {
    addProject('Atual');
    const filename = writeAutoBackupOf('Do backup');

    expect(service().restoreAutoBackup(filename)).toBe(true);

    expect(fs.existsSync(`${dbPath}-wal`)).toBe(false);
    expect(projectNamesIn(dbPath)).toEqual(['Do backup']);
    expect(electronApp.relaunch).toHaveBeenCalled();
    expect(electronApp.exit).toHaveBeenCalledWith(0);
  });

  // The name comes from the renderer over IPC; only files listed by listAutoBackups may be restored.
  it('refuses a name that is not an automatic backup file', () => {
    fs.writeFileSync(path.join(workDir, 'outro.db.gz'), gzipSync(Buffer.from('x')));

    expect(() => service().restoreAutoBackup('../outro.db.gz')).toThrow('../outro.db.gz');

    expect(adapter.getSetting('enable_auto_backups')).toBeNull();
    expect(electronApp.exit).not.toHaveBeenCalled();
  });

  it('reports the missing backup by name and keeps the database open', () => {
    expect(() => service().restoreAutoBackup('emma_backup_1999-01-01.db.gz')).toThrow(
      'Backup file emma_backup_1999-01-01.db.gz not found',
    );

    expect(adapter.getSetting('enable_auto_backups')).toBeNull();
  });
});

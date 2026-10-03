import fs from 'fs';
import path from 'path';
import os from 'os';
import { gunzipSync } from 'zlib';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UpdateSafetyService, type SafetyDatabase } from '../UpdateSafetyService';

class FakeSafetyDatabase implements SafetyDatabase {
  public checkpointCalled = false;
  public isClosed = false;

  public checkpoint(): void {
    this.checkpointCalled = true;
  }

  public close(): void {
    this.isClosed = true;
  }
}

const gunzipText = (file: string) => gunzipSync(fs.readFileSync(file)).toString('utf-8');

describe('UpdateSafetyService', () => {
  let tempDir: string;
  let dbPath: string;
  let backupsDir: string;
  let userDataDir: string;
  let fakeDb: FakeSafetyDatabase;
  let service: UpdateSafetyService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safety-test-'));
    userDataDir = path.join(tempDir, 'userData');
    backupsDir = path.join(userDataDir, 'backups');
    dbPath = path.join(userDataDir, 'emma.db');

    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(dbPath, 'library-before-update');

    fakeDb = new FakeSafetyDatabase();
    service = new UpdateSafetyService(fakeDb, dbPath, backupsDir, userDataDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a gzipped snapshot and records state before an update', () => {
    const result = service.createPreUpdateSnapshot('1.1.2', '1.2.0');

    expect(fakeDb.checkpointCalled).toBe(true);
    expect(gunzipText(result.snapshotPath)).toBe('library-before-update');
    expect(service.getUpdateState()).toEqual({
      status: 'pending_verification',
      fromVersion: '1.1.2',
      targetVersion: '1.2.0',
      snapshotPath: result.snapshotPath,
      timestamp: result.timestamp,
    });
  });

  it('leaves no temporary files behind after writing', () => {
    service.createPreUpdateSnapshot('1.1.2', '1.2.0');

    const leftovers = [...fs.readdirSync(backupsDir), ...fs.readdirSync(userDataDir)].filter((n) => n.endsWith('.tmp'));
    expect(leftovers).toEqual([]);
  });

  it('keeps only the three newest pre-update snapshots', () => {
    fs.mkdirSync(backupsDir, { recursive: true });
    for (const ts of [1000, 2000, 3000]) fs.writeFileSync(path.join(backupsDir, `pre_update_1.0.0_${ts}.db.gz`), '');
    fs.writeFileSync(path.join(backupsDir, 'emma_backup_2026-10-01.db.gz'), '');

    const { snapshotPath } = service.createPreUpdateSnapshot('1.1.2', '1.2.0');

    expect(fs.readdirSync(backupsDir).sort()).toEqual(
      [
        'emma_backup_2026-10-01.db.gz',
        'pre_update_1.0.0_2000.db.gz',
        'pre_update_1.0.0_3000.db.gz',
        path.basename(snapshotPath),
      ].sort(),
    );
  });

  it('refuses to snapshot when the database file does not exist', () => {
    fs.unlinkSync(dbPath);

    expect(() => service.createPreUpdateSnapshot('1.1.2', '1.2.0')).toThrowError(/\[ERR_DB_MISSING\].*emma\.db/);
  });

  it('refuses to snapshot without an open database to checkpoint', () => {
    const closedService = new UpdateSafetyService(null, dbPath, backupsDir, userDataDir);

    expect(() => closedService.createPreUpdateSnapshot('1.1.2', '1.2.0')).toThrowError(/open=false/);
  });

  it('restores the snapshot, removes WAL/SHM and keeps a copy of the replaced library', () => {
    service.createPreUpdateSnapshot('1.1.2', '1.2.0');
    fs.writeFileSync(dbPath, 'library-after-update');
    fs.writeFileSync(`${dbPath}-wal`, 'wal-after-update');
    fs.writeFileSync(`${dbPath}-shm`, 'shm');

    const { preRestoreBackupPath } = service.restorePreUpdateSnapshot();

    expect(fakeDb.isClosed).toBe(true);
    expect(fs.readFileSync(dbPath, 'utf-8')).toBe('library-before-update');
    expect(fs.existsSync(`${dbPath}-wal`)).toBe(false);
    expect(fs.existsSync(`${dbPath}-shm`)).toBe(false);
    expect(gunzipText(preRestoreBackupPath!)).toBe('library-after-update');
    expect(gunzipText(preRestoreBackupPath!.replace('.db.gz', '.db-wal.gz'))).toBe('wal-after-update');
    expect(service.getUpdateState()).toMatchObject({ status: 'failed', rolledBack: true, preRestoreBackupPath });
  });

  it('restores without an open database, as when the new version could not open it', () => {
    service.createPreUpdateSnapshot('1.1.2', '1.2.0');
    fs.writeFileSync(dbPath, 'library-the-new-version-cannot-open');
    const bootFailureService = new UpdateSafetyService(null, dbPath, backupsDir, userDataDir);

    bootFailureService.restorePreUpdateSnapshot();

    expect(fs.readFileSync(dbPath, 'utf-8')).toBe('library-before-update');
  });

  it('throws when no snapshot was recorded', () => {
    expect(() => service.restorePreUpdateSnapshot()).toThrowError(/\[ERR_SNAPSHOT_NOT_FOUND\].*"undefined"/);
  });

  it('throws when the recorded snapshot file is gone, leaving the library untouched', () => {
    const { snapshotPath } = service.createPreUpdateSnapshot('1.1.2', '1.2.0');
    fs.unlinkSync(snapshotPath);

    expect(() => service.restorePreUpdateSnapshot()).toThrowError(/\[ERR_SNAPSHOT_NOT_FOUND\]/);
    expect(fakeDb.isClosed).toBe(false);
    expect(fs.readFileSync(dbPath, 'utf-8')).toBe('library-before-update');
  });

  it('saves, reads, and clears update state correctly', () => {
    expect(service.getUpdateState()).toBeNull();

    service.saveUpdateState({ status: 'verified', fromVersion: '1.0.0', targetVersion: '1.1.0', timestamp: 123456 });

    expect(service.getUpdateState()).toEqual({
      status: 'verified',
      fromVersion: '1.0.0',
      targetVersion: '1.1.0',
      timestamp: 123456,
    });

    service.clearUpdateState();
    expect(service.getUpdateState()).toBeNull();
  });

  it('treats an unreadable state file as no state', () => {
    fs.writeFileSync(path.join(userDataDir, 'update_state.json'), '{not json');

    expect(service.getUpdateState()).toBeNull();
  });
});

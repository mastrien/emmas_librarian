import fs from 'fs';
import path from 'path';
import os from 'os';
import { gunzipSync } from 'zlib';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UpdateSafetyService, type SafetyDatabase } from '../UpdateSafetyService';

class FakeSafetyDatabase implements SafetyDatabase {
  public checkpointCalled = false;
  public checkIntegrityResult = true;
  public isClosed = false;

  public checkpoint(): void {
    this.checkpointCalled = true;
  }

  public checkIntegrity(): boolean {
    return this.checkIntegrityResult;
  }

  public close(): void {
    this.isClosed = true;
  }
}

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
    fs.writeFileSync(dbPath, 'dummy-sqlite-data-for-backup');

    fakeDb = new FakeSafetyDatabase();
    service = new UpdateSafetyService(fakeDb, dbPath, backupsDir, userDataDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a gzipped snapshot and records state before an update', () => {
    const result = service.createPreUpdateSnapshot('1.1.2', '1.2.0');

    expect(fakeDb.checkpointCalled).toBe(true);
    expect(fs.existsSync(result.snapshotPath)).toBe(true);
    expect(result.fromVersion).toBe('1.1.2');
    expect(result.targetVersion).toBe('1.2.0');

    const decompressed = gunzipSync(fs.readFileSync(result.snapshotPath)).toString('utf-8');
    expect(decompressed).toBe('dummy-sqlite-data-for-backup');

    const state = service.getUpdateState();
    expect(state).toEqual({
      status: 'pending_verification',
      fromVersion: '1.1.2',
      targetVersion: '1.2.0',
      snapshotPath: result.snapshotPath,
      timestamp: result.timestamp,
    });
  });

  it('throws descriptive error when creating snapshot if db file does not exist', () => {
    fs.unlinkSync(dbPath);

    expect(() => service.createPreUpdateSnapshot('1.1.2', '1.2.0')).toThrowError(
      /\[ERR_DB_MISSING\] Database file not found at/,
    );
  });

  it('restores snapshot over main database and cleans up WAL/SHM sidecars', () => {
    const { snapshotPath } = service.createPreUpdateSnapshot('1.1.2', '1.2.0');

    // Simulate database being modified and corrupted by an update
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    fs.writeFileSync(dbPath, 'corrupted-data-from-failed-migration');
    fs.writeFileSync(walPath, 'dirty-wal-content');
    fs.writeFileSync(shmPath, 'dirty-shm-content');

    const restored = service.restorePreUpdateSnapshot(snapshotPath);

    expect(restored).toBe(true);
    expect(fakeDb.isClosed).toBe(true);
    expect(fs.existsSync(walPath)).toBe(false);
    expect(fs.existsSync(shmPath)).toBe(false);

    const recoveredData = fs.readFileSync(dbPath, 'utf-8');
    expect(recoveredData).toBe('dummy-sqlite-data-for-backup');

    const state = service.getUpdateState();
    expect(state?.status).toBe('failed');
    expect(state?.rolledBack).toBe(true);
  });

  it('throws descriptive error when restoring if snapshot file does not exist', () => {
    expect(() => service.restorePreUpdateSnapshot('/invalid/nonexistent/snapshot.db.gz')).toThrowError(
      /\[ERR_SNAPSHOT_NOT_FOUND\] Snapshot file not found at/,
    );
  });

  it('saves, reads, and clears update state correctly', () => {
    expect(service.getUpdateState()).toBeNull();

    service.saveUpdateState({
      status: 'verified',
      fromVersion: '1.0.0',
      targetVersion: '1.1.0',
      timestamp: 123456,
    });

    expect(service.getUpdateState()).toEqual({
      status: 'verified',
      fromVersion: '1.0.0',
      targetVersion: '1.1.0',
      timestamp: 123456,
    });

    service.clearUpdateState();
    expect(service.getUpdateState()).toBeNull();
  });
});

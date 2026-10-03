import fs from 'fs';
import os from 'os';
import path from 'path';
import { gunzipSync } from 'zlib';
import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { UpdateSafetyService } from '../UpdateSafetyService';

vi.mock('electron', () => ({ safeStorage: {} }));

// Persistence code runs against real SQLite in WAL mode: the text-file tests cannot tell whether a
// snapshot misses pages still in the WAL, or whether a restored file actually opens.
let workDir: string;
let userData: string;
let dbPath: string;
let backupsDir: string;

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-safety-sqlite-'));
  userData = path.join(workDir, 'userData');
  dbPath = path.join(userData, 'emma.db');
  backupsDir = path.join(userData, 'backups');
  fs.mkdirSync(userData, { recursive: true });
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

function projectNamesIn(file: string): string[] {
  const db = new DatabaseAdapter(file);
  try {
    expect(db.checkIntegrity()).toBe(true);
    return db.getAllProjects().map((project) => project.name);
  } finally {
    db.close();
  }
}

/** Unpacks a gzipped backup (and its WAL, when one was saved) into its own folder, as a library file. */
function unpackBackup(gzPath: string, withWal = false): string {
  const dir = fs.mkdtempSync(path.join(workDir, 'unpacked-'));
  const target = path.join(dir, 'emma.db');
  fs.writeFileSync(target, gunzipSync(fs.readFileSync(gzPath)));
  if (withWal) fs.writeFileSync(`${target}-wal`, gunzipSync(fs.readFileSync(gzPath.replace('.db.gz', '.db-wal.gz'))));
  return target;
}

function takeSnapshotWith(projects: string[]): void {
  const db = new DatabaseAdapter(dbPath);
  projects.forEach((name) => db.createProject(name));
  new UpdateSafetyService(db, dbPath, backupsDir, userData).createPreUpdateSnapshot('1.2.0', '1.3.0');
  db.close();
}

describe('UpdateSafetyService with a real library', () => {
  it('snapshots rows that were still only in the WAL', () => {
    const db = new DatabaseAdapter(dbPath);
    db.createProject('Gravado antes da atualização');

    const { snapshotPath } = new UpdateSafetyService(db, dbPath, backupsDir, userData).createPreUpdateSnapshot(
      '1.2.0',
      '1.3.0',
    );
    db.close();

    expect(projectNamesIn(unpackBackup(snapshotPath))).toEqual(['Gravado antes da atualização']);
  });

  it('restores the snapshot over an open library, which then reopens with the old rows only', () => {
    const db = new DatabaseAdapter(dbPath);
    db.createProject('Antes');
    const safety = new UpdateSafetyService(db, dbPath, backupsDir, userData);
    safety.createPreUpdateSnapshot('1.2.0', '1.3.0');
    db.createProject('Depois');

    const { preRestoreBackupPath } = safety.restorePreUpdateSnapshot();

    expect(projectNamesIn(dbPath)).toEqual(['Antes']);
    expect(projectNamesIn(unpackBackup(preRestoreBackupPath!)).sort()).toEqual(['Antes', 'Depois']);
  });

  it('keeps rows a crashed run left in the WAL inside the pre-restore copy, not in the restored library', () => {
    takeSnapshotWith(['Antes']);
    leaveCrashedWal('Só no WAL');

    const { preRestoreBackupPath } = new UpdateSafetyService(
      null,
      dbPath,
      backupsDir,
      userData,
    ).restorePreUpdateSnapshot();

    expect(projectNamesIn(dbPath)).toEqual(['Antes']);
    expect(projectNamesIn(unpackBackup(preRestoreBackupPath!, true)).sort()).toEqual(['Antes', 'Só no WAL']);
  });
});

/**
 * Leaves emma.db plus an un-checkpointed WAL holding one more project, as a process killed mid-session
 * would. Closing a connection checkpoints the WAL, so the files are copied while it is still open.
 */
function leaveCrashedWal(projectName: string): void {
  const raw = new Database(dbPath);
  raw.pragma('journal_mode = WAL');
  raw.pragma('wal_autocheckpoint = 0');
  raw.prepare('INSERT INTO projects (name) VALUES (?)').run(projectName);
  const mainFile = fs.readFileSync(dbPath);
  const walFile = fs.readFileSync(`${dbPath}-wal`);
  raw.close();
  fs.writeFileSync(dbPath, mainFile);
  fs.writeFileSync(`${dbPath}-wal`, walFile);
}

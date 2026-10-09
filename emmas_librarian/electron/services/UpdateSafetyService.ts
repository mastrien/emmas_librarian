import fs from 'fs';
import path from 'path';
import { gzipSync, gunzipSync } from 'zlib';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { SnapshotCreationResult, SnapshotRestoreResult, UpdateStateRecord } from './UpdateTypes';

export type SafetyDatabase = Pick<DatabaseAdapter, 'checkpoint' | 'close'>;

// Each snapshot is a full copy of the library; older ones are dropped so updates don't pile them up.
const SNAPSHOTS_KEPT = 3;
const PRE_UPDATE_PREFIX = 'pre_update_';
// Copies of the library a restore replaced; every restore leaves one, so they are capped too.
const PRE_RESTORE_PREFIX = 'pre_restore_';

/**
 * Manages safety net snapshots before app updates and the rollback to them. Works without an open
 * database (db = null) so recovery still runs when the new version cannot open the library.
 *
 * Usage:
 *   const safety = new UpdateSafetyService(db, dbPath, backupsDir, userDataDir);
 *   safety.createPreUpdateSnapshot('1.1.2', '1.2.0');
 */
export class UpdateSafetyService {
  constructor(
    private readonly dbAdapter: SafetyDatabase | null,
    private readonly dbPath: string,
    private readonly backupsDir: string,
    private readonly userDataDir: string,
  ) {}

  private get stateFilePath(): string {
    return path.join(this.userDataDir, 'update_state.json');
  }

  /**
   * Reads the current update state from update_state.json.
   *
   * Usage:
   *   const state = safety.getUpdateState();
   */
  public getUpdateState(): UpdateStateRecord | null {
    if (!fs.existsSync(this.stateFilePath)) return null;
    try {
      const raw = fs.readFileSync(this.stateFilePath, 'utf-8');
      return JSON.parse(raw) as UpdateStateRecord;
    } catch {
      return null;
    }
  }

  /**
   * Saves the update state to update_state.json.
   *
   * Usage:
   *   safety.saveUpdateState({ status: 'pending_verification', fromVersion: '1.0.0' });
   */
  public saveUpdateState(state: UpdateStateRecord): void {
    fs.mkdirSync(this.userDataDir, { recursive: true });
    writeFileAtomic(this.stateFilePath, JSON.stringify(state, null, 2));
  }

  /**
   * Clears the update_state.json file.
   *
   * Usage:
   *   safety.clearUpdateState();
   */
  public clearUpdateState(): void {
    if (fs.existsSync(this.stateFilePath)) {
      fs.unlinkSync(this.stateFilePath);
    }
  }

  /**
   * Flushes SQLite WAL and creates a gzipped pre-update snapshot of the database.
   *
   * Usage:
   *   const res = safety.createPreUpdateSnapshot('1.1.0', '1.2.0');
   */
  public createPreUpdateSnapshot(fromVersion: string, targetVersion: string): SnapshotCreationResult {
    if (!this.dbAdapter || !fs.existsSync(this.dbPath)) {
      throw new Error(
        `[ERR_DB_MISSING] Cannot snapshot "${this.dbPath}": open=${Boolean(this.dbAdapter)}. Expected an open, existing SQLite file.`,
      );
    }
    this.dbAdapter.checkpoint();
    const timestamp = Date.now();
    const snapshotPath = this.writeGzipCopy(this.dbPath, `${PRE_UPDATE_PREFIX}${fromVersion}_${timestamp}.db.gz`);
    this.saveUpdateState({ status: 'pending_verification', fromVersion, targetVersion, snapshotPath, timestamp });
    this.pruneBackups(PRE_UPDATE_PREFIX);
    return { snapshotPath, fromVersion, targetVersion, timestamp };
  }

  /**
   * Puts the recorded pre-update snapshot back as the library. The current database is saved first
   * (pre_restore_*.db.gz), so a restore never destroys work done after the update.
   *
   * Usage:
   *   const { preRestoreBackupPath } = safety.restorePreUpdateSnapshot();
   */
  public restorePreUpdateSnapshot(): SnapshotRestoreResult {
    const state = this.getUpdateState();
    const snapshotPath = state?.snapshotPath;
    if (!state || !snapshotPath || !fs.existsSync(snapshotPath)) {
      throw new Error(
        `[ERR_SNAPSHOT_NOT_FOUND] Snapshot file not found at: "${snapshotPath}". Expected the gzipped copy recorded in update_state.json.`,
      );
    }
    this.assertInsideBackupsDir(snapshotPath);
    const snapshot = gunzipSync(fs.readFileSync(snapshotPath));
    // Saved while the library is still open: if saving it fails (full disk), nothing has been closed yet.
    const preRestoreBackupPath = this.backUpCurrentDatabase();
    this.dbAdapter?.close();
    writeFileAtomic(this.dbPath, snapshot);
    this.removeWalAndShm();
    this.saveUpdateState({ ...state, status: 'failed', rolledBack: true, preRestoreBackupPath });
    return { restoredFrom: snapshotPath, preRestoreBackupPath };
  }

  // update_state.json is plain text on disk; only a file this service wrote into backups/ may replace the library.
  private assertInsideBackupsDir(snapshotPath: string): void {
    const folder = path.dirname(path.resolve(snapshotPath));
    if (folder === path.resolve(this.backupsDir)) return;
    throw new Error(
      `[ERR_SNAPSHOT_OUTSIDE_BACKUPS] Snapshot "${snapshotPath}" is not inside "${this.backupsDir}". Expected a file written by createPreUpdateSnapshot.`,
    );
  }

  // A database that never opened may still hold committed pages in its WAL, so that is kept too.
  private backUpCurrentDatabase(): string | undefined {
    if (!fs.existsSync(this.dbPath)) return undefined;
    this.dbAdapter?.checkpoint();
    const name = `${PRE_RESTORE_PREFIX}${Date.now()}.db.gz`;
    const walPath = `${this.dbPath}-wal`;
    if (fs.existsSync(walPath) && fs.statSync(walPath).size > 0) {
      this.writeGzipCopy(walPath, name.replace('.db.gz', '.db-wal.gz'));
    }
    const backupPath = this.writeGzipCopy(this.dbPath, name);
    this.pruneBackups(PRE_RESTORE_PREFIX);
    return backupPath;
  }

  private writeGzipCopy(sourcePath: string, filename: string): string {
    fs.mkdirSync(this.backupsDir, { recursive: true });
    const target = path.join(this.backupsDir, filename);
    writeFileAtomic(target, gzipSync(fs.readFileSync(sourcePath)));
    return target;
  }

  // Age comes from the timestamp in the name: file mtimes can tie when snapshots are taken close together.
  // A db file and its -wal companion share a timestamp, so they are kept or dropped together.
  private pruneBackups(prefix: string): void {
    const names = fs.readdirSync(this.backupsDir).filter((name) => name.startsWith(prefix));
    const newestFirst = [...new Set(names.map(backupTimestamp))].sort((a, b) => b - a);
    const kept = new Set(newestFirst.slice(0, SNAPSHOTS_KEPT));
    names
      .filter((name) => !kept.has(backupTimestamp(name)))
      .forEach((name) => fs.unlinkSync(path.join(this.backupsDir, name)));
  }

  private removeWalAndShm(): void {
    for (const sidecar of [`${this.dbPath}-wal`, `${this.dbPath}-shm`]) {
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    }
  }
}

const backupTimestamp = (name: string): number => Number(/_(\d+)\.db(?:-wal)?\.gz$/.exec(name)?.[1] ?? 0);

// Write next to the target, then rename: a crash mid-write leaves the old file, never half of one.
function writeFileAtomic(target: string, contents: string | Buffer): void {
  const temp = `${target}.tmp`;
  fs.writeFileSync(temp, contents);
  fs.renameSync(temp, target);
}

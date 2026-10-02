import fs from 'fs';
import path from 'path';
import { gzipSync, gunzipSync } from 'zlib';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { SnapshotCreationResult, UpdateStateRecord } from './UpdateTypes';

export type SafetyDatabase = Pick<DatabaseAdapter, 'checkpoint' | 'checkIntegrity' | 'close'>;

/**
 * Manages safety net snapshots before app updates and safe database rollback if verification fails.
 *
 * Usage:
 *   const safety = new UpdateSafetyService(db, dbPath, backupsDir, userDataDir);
 *   safety.createPreUpdateSnapshot('1.1.2', '1.2.0');
 */
export class UpdateSafetyService {
  constructor(
    private readonly dbAdapter: SafetyDatabase,
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
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }
    fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2), 'utf-8');
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
    if (!fs.existsSync(this.dbPath)) {
      throw new Error(`[ERR_DB_MISSING] Database file not found at: "${this.dbPath}". Expected existing SQLite file.`);
    }

    this.dbAdapter.checkpoint();
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const filename = `pre_update_${fromVersion}_${timestamp}.db.gz`;
    const snapshotPath = path.join(this.backupsDir, filename);

    const dbData = fs.readFileSync(this.dbPath);
    const compressed = gzipSync(dbData);
    fs.writeFileSync(snapshotPath, compressed);

    const state: UpdateStateRecord = {
      status: 'pending_verification',
      fromVersion,
      targetVersion,
      snapshotPath,
      timestamp,
    };
    this.saveUpdateState(state);

    return { snapshotPath, fromVersion, targetVersion, timestamp };
  }

  /**
   * Restores a pre-update snapshot back over the main database, wiping WAL and SHM files.
   *
   * Usage:
   *   safety.restorePreUpdateSnapshot();
   */
  public restorePreUpdateSnapshot(explicitPath?: string): boolean {
    const targetPath = explicitPath || this.getUpdateState()?.snapshotPath;
    if (!targetPath || !fs.existsSync(targetPath)) {
      throw new Error(
        `[ERR_SNAPSHOT_NOT_FOUND] Snapshot file not found at: "${targetPath}". Expected existing gzipped database copy.`,
      );
    }

    const compressed = fs.readFileSync(targetPath);
    const decompressed = gunzipSync(compressed);

    this.dbAdapter.close();
    this.removeWalAndShm();
    fs.writeFileSync(this.dbPath, decompressed);

    const currentState = this.getUpdateState();
    if (currentState) {
      this.saveUpdateState({ ...currentState, status: 'failed', rolledBack: true });
    }

    return true;
  }

  private removeWalAndShm(): void {
    const walPath = `${this.dbPath}-wal`;
    const shmPath = `${this.dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  }
}

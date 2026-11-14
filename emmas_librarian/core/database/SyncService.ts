import { DatabaseAdapter } from './DatabaseAdapter';
import { ProjectSyncService } from './ProjectSyncService';
import { BackupService } from './BackupService';
import type { AppPaths } from '../ports/AppPaths';
import type { AppRuntime } from '../ports/AppRuntime';

/**
 * Library files that leave or enter the app: one project (.emmapcarc) or the whole library (.emmabak).
 *
 * Usage:
 *   const sync = new SyncService(db, appPathsIn(userData), runtime);
 *   await sync.exportProject(3, '/home/ana/tese.emmapcarc');
 */
export class SyncService {
  private projectSync: ProjectSyncService;
  private backupSync: BackupService;

  constructor(dbAdapter: DatabaseAdapter, paths: AppPaths, runtime: AppRuntime) {
    this.projectSync = new ProjectSyncService(dbAdapter, paths);
    this.backupSync = new BackupService(dbAdapter, paths, runtime);
  }

  public async exportProject(projectId: number, filePath: string): Promise<string> {
    return this.projectSync.exportProject(projectId, filePath);
  }

  public async importProject(importPath: string): Promise<number> {
    return this.projectSync.importProject(importPath);
  }

  public async exportBackup(filePath: string): Promise<string> {
    return this.backupSync.exportBackup(filePath);
  }

  public async restoreBackupOverride(importPath: string): Promise<boolean> {
    return this.backupSync.restoreBackupOverride(importPath);
  }

  public async restoreBackupMerge(importPath: string): Promise<number> {
    return this.backupSync.restoreBackupMerge(importPath);
  }
}

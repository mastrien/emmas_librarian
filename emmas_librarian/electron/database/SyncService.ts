import { DatabaseAdapter } from './DatabaseAdapter';
import { ProjectSyncService } from './ProjectSyncService';
import { BackupService } from './BackupService';

export class SyncService {
  private projectSync: ProjectSyncService;
  private backupSync: BackupService;

  constructor(private dbAdapter: DatabaseAdapter) {
    this.projectSync = new ProjectSyncService(dbAdapter);
    this.backupSync = new BackupService(dbAdapter);
  }

  public async exportProject(projectId: number): Promise<string | null> {
    return this.projectSync.exportProject(projectId);
  }

  public async importProject(providedPath?: string): Promise<number | null> {
    return this.projectSync.importProject(providedPath);
  }

  public async exportBackup(): Promise<string | null> {
    return this.backupSync.exportBackup();
  }

  public async restoreBackupOverride(providedPath?: string): Promise<boolean> {
    return this.backupSync.restoreBackupOverride(providedPath);
  }

  public async restoreBackupMerge(providedPath?: string): Promise<number> {
    return this.backupSync.restoreBackupMerge(providedPath);
  }
}

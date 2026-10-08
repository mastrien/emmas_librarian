import type {
  IAppUpdater,
  UpdateCheckStatus,
  UpdateInfoPayload,
  DownloadProgressPayload,
  UpdateStatusResponse,
} from './UpdateTypes';
import type { UpdateSafetyService } from './UpdateSafetyService';

type StatusListener = (status: UpdateStatusResponse) => void;
type ProgressListener = (progress: DownloadProgressPayload) => void;

/**
 * Coordinates opt-in application updates, download tracking, and pre-update snapshots.
 *
 * Usage:
 *   const manager = new UpdateManager(autoUpdater, safetyService);
 *   await manager.checkForUpdates();
 */
export class UpdateManager {
  private currentStatus: UpdateCheckStatus = 'idle';
  private updateInfo: UpdateInfoPayload | null = null;
  private downloadProgress: DownloadProgressPayload | null = null;
  private errorMessage: string | null = null;
  private readonly statusListeners = new Set<StatusListener>();
  private readonly progressListeners = new Set<ProgressListener>();

  constructor(
    private readonly updater: IAppUpdater,
    private readonly safetyService: UpdateSafetyService,
  ) {
    this.configureUpdater();
    this.bindUpdaterEvents();
  }

  private configureUpdater(): void {
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = false;
  }

  private bindUpdaterEvents(): void {
    this.updater.on('checking-for-update', () => this.handleChecking());
    this.updater.on('update-available', (info: unknown) => this.handleUpdateAvailable(info));
    this.updater.on('update-not-available', () => this.handleUpdateNotAvailable());
    this.updater.on('error', (err: unknown) => this.handleUpdaterError(err));
    this.updater.on('download-progress', (progress: unknown) => this.handleDownloadProgress(progress));
    this.updater.on('update-downloaded', (info: unknown) => this.handleUpdateDownloaded(info));
  }

  private handleChecking(): void {
    this.currentStatus = 'checking';
    this.errorMessage = null;
    this.notifyStatusListeners();
  }

  private handleUpdateAvailable(info: unknown): void {
    this.currentStatus = 'available';
    const payload = info as { version?: string; releaseDate?: string; releaseNotes?: string | unknown };
    this.updateInfo = {
      version: payload.version || 'unknown',
      releaseDate: payload.releaseDate,
      releaseNotes: typeof payload.releaseNotes === 'string' ? payload.releaseNotes : undefined,
    };
    this.notifyStatusListeners();
  }

  private handleUpdateNotAvailable(): void {
    this.currentStatus = 'not-available';
    this.notifyStatusListeners();
  }

  private handleUpdaterError(err: unknown): void {
    this.currentStatus = 'error';
    this.errorMessage = err instanceof Error ? err.message : String(err);
    this.notifyStatusListeners();
  }

  private handleDownloadProgress(progress: unknown): void {
    this.currentStatus = 'downloading';
    const raw = progress as { percent?: number; bytesPerSecond?: number; transferred?: number; total?: number };
    this.downloadProgress = {
      percent: raw.percent || 0,
      bytesPerSecond: raw.bytesPerSecond || 0,
      transferred: raw.transferred || 0,
      total: raw.total || 0,
    };
    this.progressListeners.forEach((listener) => listener(this.downloadProgress!));
    this.notifyStatusListeners();
  }

  private handleUpdateDownloaded(info: unknown): void {
    this.currentStatus = 'downloaded';
    if (!this.updateInfo) {
      const payload = info as { version?: string; releaseDate?: string; releaseNotes?: string | unknown };
      this.updateInfo = {
        version: payload.version || 'unknown',
        releaseDate: payload.releaseDate,
      };
    }
    this.notifyStatusListeners();
  }

  public async checkForUpdates(): Promise<UpdateInfoPayload | null> {
    this.handleChecking();
    try {
      await this.updater.checkForUpdates();
      return this.updateInfo;
    } catch (err: unknown) {
      this.handleUpdaterError(err);
      return null;
    }
  }

  public async downloadUpdate(): Promise<void> {
    if (this.currentStatus !== 'available' && this.currentStatus !== 'downloaded') {
      throw new Error(`[ERR_UPDATE_NOT_AVAILABLE] Cannot download update in state: "${this.currentStatus}".`);
    }
    this.currentStatus = 'downloading';
    this.notifyStatusListeners();
    try {
      await this.updater.downloadUpdate();
    } catch (err: unknown) {
      this.handleUpdaterError(err);
      throw err;
    }
  }

  public async prepareAndInstall(fromVersion: string): Promise<void> {
    if (this.currentStatus !== 'downloaded') {
      throw new Error(`[ERR_UPDATE_NOT_DOWNLOADED] Cannot install update in state: "${this.currentStatus}".`);
    }
    const targetVersion = this.updateInfo?.version || 'latest';
    this.safetyService.createPreUpdateSnapshot(fromVersion, targetVersion);
    // Silent like the updates before 1.3 (the installer is the assisted kind: not silent, it opens a wizard
    // with a "Concluir" page), and the app reopens by itself once installed.
    this.updater.quitAndInstall(true, true);
  }

  public getStatus(): UpdateStatusResponse {
    return {
      status: this.currentStatus,
      updateInfo: this.updateInfo,
      downloadProgress: this.downloadProgress,
      error: this.errorMessage,
      state: this.safetyService.getUpdateState(),
    };
  }

  public addStatusListener(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  public addProgressListener(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  private notifyStatusListeners(): void {
    const current = this.getStatus();
    this.statusListeners.forEach((listener) => listener(current));
  }
}

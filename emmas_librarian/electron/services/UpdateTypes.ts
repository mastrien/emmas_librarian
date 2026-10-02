import type {
  UpdateCheckStatus,
  UpdateInfoPayload,
  DownloadProgressPayload,
  UpdateStateRecord,
  UpdateStatusResponse,
} from '../../src/types';

export type { UpdateCheckStatus, UpdateInfoPayload, DownloadProgressPayload, UpdateStateRecord, UpdateStatusResponse };

/**
 * Minimal abstraction over electron-updater's AppUpdater to permit test isolation and mocking.
 */
export interface IAppUpdater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  logger: unknown;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeAllListeners?(event?: string): void;
}

/**
 * Result of creating a pre-update snapshot.
 */
export interface SnapshotCreationResult {
  snapshotPath: string;
  fromVersion: string;
  targetVersion: string;
  timestamp: number;
}

/**
 * Result of the startup health check.
 */
export interface HealthCheckResult {
  needed: boolean;
  passed: boolean;
  error?: string;
  state?: UpdateStateRecord | null;
}

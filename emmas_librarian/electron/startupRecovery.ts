import path from 'path';
import type { UpdateSafetyService } from './services/UpdateSafetyService';
import type { RecoveryService } from './services/RecoveryService';

export interface LibraryPaths {
  userData: string;
  dbPath: string;
  backupsDir: string;
}

/**
 * Where the library lives inside the userData folder; shared by the normal startup and the recovery
 * that runs when that startup fails.
 *
 * Usage:
 *   const { dbPath, backupsDir } = libraryPaths(app.getPath('userData'));
 */
export function libraryPaths(userData: string): LibraryPaths {
  return { userData, dbPath: path.join(userData, 'emma.db'), backupsDir: path.join(userData, 'backups') };
}

export type StartupRecoveryState = Pick<UpdateSafetyService, 'getUpdateState' | 'saveUpdateState'>;
export type StartupRecoveryPrompt = Pick<RecoveryService, 'handlePostUpdateFailure'>;

/**
 * Offers the post-update recovery dialog when startup threw before the health check could run
 * (v1.2.0 failed this way: the library never opened). Only for the version the recorded update
 * installed, so an unrelated failure months later does not offer an old snapshot.
 *
 * Usage:
 *   if (!offerRecoveryAfterFailedStartup(err, app.getVersion(), safety, recovery)) dialog.showErrorBox(...);
 */
export function offerRecoveryAfterFailedStartup(
  error: unknown,
  runningVersion: string,
  safety: StartupRecoveryState,
  recovery: StartupRecoveryPrompt,
): boolean {
  const state = safety.getUpdateState();
  if (!state?.snapshotPath || state.targetVersion !== runningVersion || state.status === 'verified') return false;
  const message = error instanceof Error ? error.message : String(error);
  const failedState = { ...state, status: 'failed' as const, error: message };
  safety.saveUpdateState(failedState);
  recovery.handlePostUpdateFailure(message, failedState);
  return true;
}

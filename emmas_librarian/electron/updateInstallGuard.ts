import type { UpdateSafetyService } from './services/UpdateSafetyService';
import type { UpdateStateRecord } from './services/UpdateTypes';

/**
 * How long after "Reiniciar e Instalar" a start of the old version counts as a reopen during the install. A silent
 * install took 18-28 s on the runners and the old app needed up to ~60 s to quit (#22), so three minutes covers both.
 */
export const INSTALL_WINDOW_MS = 3 * 60 * 1000;

export type StartupUpdateVerdict = 'normal' | 'install_in_progress' | 'not_applied' | 'landed_late';
export type InstallingChoice = 'quit' | 'open';

export type GuardSafety = Pick<UpdateSafetyService, 'getUpdateState' | 'saveUpdateState'>;

export interface StartupGuardDeps {
  safety: GuardSafety;
  runningVersion: string;
  now: () => number;
  /** Asks the person what to do when the old version was opened while its installer is still working. */
  askWhileInstalling: (targetVersion: string) => InstallingChoice;
  logWarning: (message: string) => void;
}

function installedRecently(state: UpdateStateRecord, now: number): boolean {
  return state.installStartedAt !== undefined && now - state.installStartedAt < INSTALL_WINDOW_MS;
}

/**
 * Says what a start means for the update recorded in update_state.json, from the version that is running: the
 * recorded `fromVersion` is still running when the installer has not replaced it (yet).
 *
 * Usage:
 *   judgeStartupAfterUpdate(state, app.getVersion(), Date.now()); // 'install_in_progress'
 */
export function judgeStartupAfterUpdate(
  state: UpdateStateRecord | null,
  runningVersion: string,
  now: number,
): StartupUpdateVerdict {
  if (!state || (state.status !== 'pending_verification' && state.status !== 'not_applied')) return 'normal';
  if (runningVersion !== state.fromVersion) return state.status === 'not_applied' ? 'landed_late' : 'normal';
  if (state.status === 'not_applied') return 'not_applied';
  return installedRecently(state, now) ? 'install_in_progress' : 'not_applied';
}

function describeNotApplied(state: UpdateStateRecord, runningVersion: string): string {
  return `[ERR_UPDATE_NOT_APPLIED] The update to "${state.targetVersion}" was started but "${runningVersion}" is still running. Expected the installer to have replaced it.`;
}

function recordNotApplied(deps: StartupGuardDeps, state: UpdateStateRecord): void {
  const error = describeNotApplied(state, deps.runningVersion);
  deps.logWarning(error);
  deps.safety.saveUpdateState({ ...state, status: 'not_applied', error });
}

// An installer that outlived its app can finish minutes later; the new version's first start must then be checked.
function recordLandedLate(deps: StartupGuardDeps, state: UpdateStateRecord): void {
  deps.logWarning(`The update to "${state.targetVersion}" landed after being recorded as not applied; verifying it.`);
  deps.safety.saveUpdateState({ ...state, status: 'pending_verification', error: undefined });
}

/**
 * Runs before the library is opened. Stops a second start of the old version from fighting its own installer
 * (the installer then never finishes and the update is silently lost, #22), and records an update that did not
 * land so the first-start health check cannot mark it verified.
 *
 * Usage:
 *   if (runStartupUpdateGuard(deps) === 'quit') app.quit();
 */
export function runStartupUpdateGuard(deps: StartupGuardDeps): 'continue' | 'quit' {
  const state = deps.safety.getUpdateState();
  const verdict = judgeStartupAfterUpdate(state, deps.runningVersion, deps.now());
  if (!state || verdict === 'normal') return 'continue';
  if (verdict === 'landed_late') recordLandedLate(deps, state);
  if (verdict === 'not_applied') recordNotApplied(deps, state);
  if (verdict !== 'install_in_progress') return 'continue';
  if (deps.askWhileInstalling(state.targetVersion ?? 'latest') === 'quit') return 'quit';
  // Opened anyway: the installer was interrupted by this start, so the update is not applied.
  recordNotApplied(deps, state);
  return 'continue';
}

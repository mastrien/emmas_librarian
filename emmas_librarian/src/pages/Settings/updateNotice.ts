import type { UpdateStatusResponse } from '../../types';

/**
 * Whether Settings should tell that an update was started and never landed (#22): the recorded state says
 * `not_applied`, the installed version is still not the target, and a fresh check has not just said "up to date".
 *
 * Usage:
 *   showsNotAppliedNotice(updateStatus, '1.2.2'); // true after a reopen killed the installer
 */
export function showsNotAppliedNotice(updateStatus: UpdateStatusResponse, currentVersion: string): boolean {
  const state = updateStatus.state;
  if (state?.status !== 'not_applied' || updateStatus.status === 'not-available') return false;
  return state.targetVersion !== currentVersion;
}

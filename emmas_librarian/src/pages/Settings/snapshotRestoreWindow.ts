import type { UpdateStateRecord } from '../../types';

// update_state.json is never cleared, so without a limit the restore button would offer a months-old
// snapshot of a library that has changed a lot since. After an update that verified fine, two weeks is
// the span in which "the new version broke something" is still a plausible reason to go back.
export const VERIFIED_SNAPSHOT_RESTORE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether Settings should still offer to put the pre-update snapshot back: always while the update is
 * unverified or failed, but only for a short while once it was verified, and never after it was restored.
 *
 * Usage:
 *   canOfferSnapshotRestore(state) // true right after an update, false 3 months later
 */
export function canOfferSnapshotRestore(state: UpdateStateRecord | null, now: number = Date.now()): boolean {
  if (!state?.snapshotPath || state.rolledBack) return false;
  if (state.status !== 'verified' || state.timestamp === undefined) return true;
  return now - state.timestamp <= VERIFIED_SNAPSHOT_RESTORE_DAYS * DAY_MS;
}

import { describe, it, expect } from 'vitest';
import { canOfferSnapshotRestore, VERIFIED_SNAPSHOT_RESTORE_DAYS } from '../snapshotRestoreWindow';
import type { UpdateStateRecord } from '../../../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date(2026, 9, 8, 12, 0, 0).getTime();
const withSnapshot: UpdateStateRecord = { status: 'verified', snapshotPath: '/backups/pre_update_1.1.2_1.db.gz' };

describe('canOfferSnapshotRestore', () => {
  it('offers nothing without a recorded snapshot', () => {
    expect(canOfferSnapshotRestore(null, now)).toBe(false);
    expect(canOfferSnapshotRestore({ status: 'failed' }, now)).toBe(false);
  });

  it.each(['pending_verification', 'failed', 'idle'] as const)(
    'offers it while the update is %s, however old',
    (status) => {
      const state = { ...withSnapshot, status, timestamp: now - 400 * DAY_MS };

      expect(canOfferSnapshotRestore(state, now)).toBe(true);
    },
  );

  it('offers it for a verified update until the window ends', () => {
    const edge = { ...withSnapshot, timestamp: now - VERIFIED_SNAPSHOT_RESTORE_DAYS * DAY_MS };

    expect(canOfferSnapshotRestore(edge, now)).toBe(true);
    expect(canOfferSnapshotRestore({ ...edge, timestamp: edge.timestamp! - 1 }, now)).toBe(false);
  });

  it('keeps offering a verified snapshot whose date was not recorded', () => {
    expect(canOfferSnapshotRestore(withSnapshot, now)).toBe(true);
  });

  it('stops offering it once it was restored', () => {
    expect(canOfferSnapshotRestore({ ...withSnapshot, status: 'failed', rolledBack: true, timestamp: now }, now)).toBe(
      false,
    );
  });
});

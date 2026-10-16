import { describe, it, expect } from 'vitest';
import { showsNotAppliedNotice } from '../updateNotice';
import type { UpdateStatusResponse } from '../../../types';

function response(overrides: Partial<UpdateStatusResponse> = {}): UpdateStatusResponse {
  return {
    status: 'idle',
    updateInfo: null,
    downloadProgress: null,
    error: null,
    state: { status: 'not_applied', fromVersion: '1.2.2', targetVersion: '1.3.0' },
    ...overrides,
  };
}

describe('showsNotAppliedNotice', () => {
  it('tells about an update that was started and never landed', () => {
    expect(showsNotAppliedNotice(response(), '1.2.2')).toBe(true);
  });

  it('stays quiet for any other recorded state', () => {
    const verified = response({ state: { status: 'verified', targetVersion: '1.3.0' } });

    expect(showsNotAppliedNotice(verified, '1.3.0')).toBe(false);
    expect(showsNotAppliedNotice(response({ state: null }), '1.2.2')).toBe(false);
  });

  it('stays quiet once the target is the installed version, or a check says the app is up to date', () => {
    expect(showsNotAppliedNotice(response(), '1.3.0')).toBe(false);
    expect(showsNotAppliedNotice(response({ status: 'not-available' }), '1.2.2')).toBe(false);
  });
});

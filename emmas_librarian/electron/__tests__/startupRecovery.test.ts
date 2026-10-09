import path from 'path';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  libraryPaths,
  offerRecoveryAfterFailedStartup,
  type StartupRecoveryPrompt,
  type StartupRecoveryState,
} from '../startupRecovery';
import type { UpdateStateRecord } from '../services/UpdateTypes';

class FakeUpdateStateFile implements StartupRecoveryState {
  constructor(public state: UpdateStateRecord | null) {}

  public getUpdateState(): UpdateStateRecord | null {
    return this.state;
  }

  public saveUpdateState(state: UpdateStateRecord): void {
    this.state = state;
  }
}

class FakeRecoveryPrompt implements StartupRecoveryPrompt {
  public prompts: { error: string; state?: UpdateStateRecord | null }[] = [];

  public handlePostUpdateFailure(error: string, state?: UpdateStateRecord | null): void {
    this.prompts.push({ error, state });
  }
}

const justUpdated: UpdateStateRecord = {
  status: 'pending_verification',
  fromVersion: '1.1.23',
  targetVersion: '1.2.0',
  snapshotPath: 'C:/backups/pre_update_1.1.23_1.db.gz',
};

describe('libraryPaths', () => {
  it('places the database and backups inside userData', () => {
    const userData = path.join('C:', 'data');

    expect(libraryPaths(userData)).toEqual({
      userData,
      dbPath: path.join(userData, 'emma.db'),
      backupsDir: path.join(userData, 'backups'),
    });
  });
});

describe('offerRecoveryAfterFailedStartup', () => {
  let prompt: FakeRecoveryPrompt;

  beforeEach(() => {
    prompt = new FakeRecoveryPrompt();
  });

  it('offers recovery when the version an update just installed fails to start', () => {
    const stateFile = new FakeUpdateStateFile(justUpdated);

    const offered = offerRecoveryAfterFailedStartup(new Error('no such column: x'), '1.2.0', stateFile, prompt);

    expect(offered).toBe(true);
    expect(stateFile.state).toMatchObject({ status: 'failed', error: 'no such column: x' });
    expect(prompt.prompts).toEqual([{ error: 'no such column: x', state: stateFile.state }]);
  });

  it('offers it again on the next failed start of the same version', () => {
    const stateFile = new FakeUpdateStateFile({ ...justUpdated, status: 'failed', rolledBack: true });

    expect(offerRecoveryAfterFailedStartup('still broken', '1.2.0', stateFile, prompt)).toBe(true);
    expect(prompt.prompts[0].error).toBe('still broken');
  });

  it.each(['unknown', 'latest'])(
    'offers recovery on the first start after an update whose version the updater did not report (%s)',
    (targetVersion) => {
      const stateFile = new FakeUpdateStateFile({ ...justUpdated, targetVersion });

      expect(offerRecoveryAfterFailedStartup(new Error('boom'), '1.2.0', stateFile, prompt)).toBe(true);
    },
  );

  it.each([
    ['the old version is the one running', { ...justUpdated, targetVersion: 'unknown' }, '1.1.23'],
    [
      'the start was already reported as failed',
      { ...justUpdated, targetVersion: 'unknown', status: 'failed' as const },
      '1.2.0',
    ],
    ['the recorded version is a real, different one', { ...justUpdated, targetVersion: '1.3.0' }, '1.2.0'],
  ])('does not guess the update when %s', (_reason, state, running) => {
    const stateFile = new FakeUpdateStateFile(state);

    expect(offerRecoveryAfterFailedStartup(new Error('boom'), running, stateFile, prompt)).toBe(false);
  });

  it.each([
    ['no update was recorded', null],
    ['the update was already verified', { ...justUpdated, status: 'verified' as const }],
    ['another version is running', { ...justUpdated, targetVersion: '1.3.0' }],
    ['no snapshot was taken', { ...justUpdated, snapshotPath: undefined }],
  ])('leaves the plain error dialog when %s', (_reason, state) => {
    const stateFile = new FakeUpdateStateFile(state);

    expect(offerRecoveryAfterFailedStartup(new Error('boom'), '1.2.0', stateFile, prompt)).toBe(false);
    expect(prompt.prompts).toEqual([]);
    expect(stateFile.state).toEqual(state);
  });
});

// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  INSTALL_WINDOW_MS,
  judgeStartupAfterUpdate,
  runStartupUpdateGuard,
  type GuardSafety,
  type InstallingChoice,
} from '../updateInstallGuard';
import { UpdateSafetyService } from '../services/UpdateSafetyService';
import { UpdateHealthChecker, type HealthCheckDatabase } from '../services/UpdateHealthChecker';
import type { UpdateStateRecord } from '../services/UpdateTypes';

const NOW = 1_800_000_000_000;

function pending(overrides: Partial<UpdateStateRecord> = {}): UpdateStateRecord {
  return {
    status: 'pending_verification',
    fromVersion: '1.2.2',
    targetVersion: '1.3.0',
    snapshotPath: '/backups/pre_update_1.2.2_1.db.gz',
    installStartedAt: NOW - 5_000,
    ...overrides,
  };
}

class FakeGuardSafety implements GuardSafety {
  public saved: UpdateStateRecord[] = [];
  constructor(public state: UpdateStateRecord | null) {}

  public getUpdateState(): UpdateStateRecord | null {
    return this.state;
  }

  public saveUpdateState(state: UpdateStateRecord): void {
    this.saved.push(state);
    this.state = state;
  }
}

describe('judgeStartupAfterUpdate', () => {
  it('has nothing to say without a recorded update, or one that is already settled', () => {
    expect(judgeStartupAfterUpdate(null, '1.2.2', NOW)).toBe('normal');
    expect(judgeStartupAfterUpdate(pending({ status: 'verified' }), '1.2.2', NOW)).toBe('normal');
    expect(judgeStartupAfterUpdate(pending({ status: 'failed' }), '1.2.2', NOW)).toBe('normal');
  });

  it('lets the new version through to its first-boot check', () => {
    expect(judgeStartupAfterUpdate(pending(), '1.3.0', NOW)).toBe('normal');
  });

  it('recognises the old version opened while its installer works', () => {
    expect(judgeStartupAfterUpdate(pending(), '1.2.2', NOW)).toBe('install_in_progress');
  });

  it('stops calling it in progress once the window ends', () => {
    const state = pending({ installStartedAt: NOW - INSTALL_WINDOW_MS });

    expect(judgeStartupAfterUpdate(state, '1.2.2', NOW)).toBe('not_applied');
  });

  it('calls a state with no install start (an older build, or a snapshot that never installed) not applied', () => {
    expect(judgeStartupAfterUpdate(pending({ installStartedAt: undefined }), '1.2.2', NOW)).toBe('not_applied');
  });

  it('keeps an update recorded as not applied while the old version still runs', () => {
    expect(judgeStartupAfterUpdate(pending({ status: 'not_applied' }), '1.2.2', NOW)).toBe('not_applied');
  });

  it('notices an installer that finished late', () => {
    expect(judgeStartupAfterUpdate(pending({ status: 'not_applied' }), '1.3.0', NOW)).toBe('landed_late');
  });
});

describe('runStartupUpdateGuard', () => {
  const asked: string[] = [];
  const warnings: string[] = [];

  function run(state: UpdateStateRecord | null, runningVersion: string, choice: InstallingChoice = 'quit') {
    const safety = new FakeGuardSafety(state);
    const result = runStartupUpdateGuard({
      safety,
      runningVersion,
      now: () => NOW,
      askWhileInstalling: (target) => {
        asked.push(target);
        return choice;
      },
      logWarning: (message) => warnings.push(message),
    });
    return { result, safety };
  }

  beforeEach(() => {
    asked.length = 0;
    warnings.length = 0;
  });

  it('quits, without touching the state, when the person closes the dialog during the install', () => {
    const { result, safety } = run(pending(), '1.2.2', 'quit');

    expect(result).toBe('quit');
    expect(asked).toEqual(['1.3.0']);
    expect(safety.saved).toEqual([]);
  });

  it('records the update as not applied when the person opens the app anyway', () => {
    const { result, safety } = run(pending(), '1.2.2', 'open');

    expect(result).toBe('continue');
    expect(safety.saved[0]).toMatchObject({ status: 'not_applied', targetVersion: '1.3.0' });
    expect(safety.saved[0].error).toMatch(/ERR_UPDATE_NOT_APPLIED.*"1\.3\.0".*"1\.2\.2"/);
  });

  it('records and warns, without asking, when the update never landed', () => {
    const { result, safety } = run(pending({ installStartedAt: NOW - 10 * INSTALL_WINDOW_MS }), '1.2.2');

    expect(result).toBe('continue');
    expect(asked).toEqual([]);
    expect(safety.saved[0].status).toBe('not_applied');
    expect(warnings).toHaveLength(1);
  });

  it('puts a late-landing update back to pending so the health check runs on it', () => {
    const { result, safety } = run(pending({ status: 'not_applied', error: 'old' }), '1.3.0');

    expect(result).toBe('continue');
    expect(safety.saved[0].status).toBe('pending_verification');
    expect(safety.saved[0].error).toBeUndefined();
  });

  it('does nothing on a normal start', () => {
    const { result, safety } = run(null, '1.2.2');

    expect(result).toBe('continue');
    expect(safety.saved).toEqual([]);
    expect(asked).toEqual([]);
  });
});

/**
 * Regression for #22: the old version reopened after an update that never landed found a healthy library, passed
 * the first-boot check and wrote "verified" over an update that had not happened. Real files, the real checker.
 */
describe('an update that did not land is never marked verified (#22)', () => {
  class HealthyDatabase implements HealthCheckDatabase {
    public checkQuickIntegrity(): boolean {
      return true;
    }

    public getDB(): ReturnType<HealthCheckDatabase['getDB']> {
      return { prepare: () => ({ get: () => ({ count: 0 }) }) } as unknown as ReturnType<HealthCheckDatabase['getDB']>;
    }
  }

  let folder: string;
  let safety: UpdateSafetyService;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'install-guard-'));
    safety = new UpdateSafetyService(null, path.join(folder, 'emma.db'), path.join(folder, 'backups'), folder);
    safety.saveUpdateState(pending({ installStartedAt: undefined }));
  });

  afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

  function startOldVersion(): void {
    runStartupUpdateGuard({
      safety,
      runningVersion: '1.2.2',
      now: () => NOW,
      askWhileInstalling: () => 'quit',
      logWarning: () => undefined,
    });
    new UpdateHealthChecker(new HealthyDatabase(), safety).runStartupHealthCheck();
  }

  it('leaves the update recorded as not applied after the old version started', () => {
    startOldVersion();

    expect(safety.getUpdateState()).toMatchObject({ status: 'not_applied', targetVersion: '1.3.0' });
  });

  it('still verifies the new version on its first start', () => {
    runStartupUpdateGuard({
      safety,
      runningVersion: '1.3.0',
      now: () => NOW,
      askWhileInstalling: () => 'quit',
      logWarning: () => undefined,
    });
    new UpdateHealthChecker(new HealthyDatabase(), safety).runStartupHealthCheck();

    expect(safety.getUpdateState()?.status).toBe('verified');
  });
});

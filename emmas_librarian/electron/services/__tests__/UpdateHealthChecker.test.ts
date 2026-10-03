import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateHealthChecker, type HealthCheckDatabase, type HealthCheckSafetyService } from '../UpdateHealthChecker';
import type { UpdateStateRecord } from '../UpdateTypes';

class FakeHealthDatabase implements HealthCheckDatabase {
  public integrityResult = true;
  public queriesExecuted: string[] = [];
  public shouldFailQuery = false;

  public checkIntegrity(): boolean {
    return this.integrityResult;
  }

  public getDB(): { prepare: (sql: string) => { get: () => unknown } } {
    return {
      prepare: (sql: string) => {
        this.queriesExecuted.push(sql);
        if (this.shouldFailQuery && sql.includes('projects')) {
          throw new Error('no such table: projects');
        }
        return {
          get: () => ({ count: 1 }),
        };
      },
    };
  }
}

class FakeHealthSafetyService implements HealthCheckSafetyService {
  public state: UpdateStateRecord | null = null;
  public savedStates: UpdateStateRecord[] = [];

  public getUpdateState(): UpdateStateRecord | null {
    return this.state;
  }

  public saveUpdateState(state: UpdateStateRecord): void {
    this.state = state;
    this.savedStates.push(state);
  }
}

describe('UpdateHealthChecker', () => {
  let fakeDb: FakeHealthDatabase;
  let fakeSafety: FakeHealthSafetyService;
  let checker: UpdateHealthChecker;

  beforeEach(() => {
    fakeDb = new FakeHealthDatabase();
    fakeSafety = new FakeHealthSafetyService();
    checker = new UpdateHealthChecker(fakeDb, fakeSafety);
  });

  it('skips health check when state is not pending_verification', () => {
    fakeSafety.state = { status: 'verified', fromVersion: '1.0.0', targetVersion: '1.1.0' };

    const result = checker.runStartupHealthCheck();

    expect(result.needed).toBe(false);
    expect(result.passed).toBe(true);
    expect(fakeDb.queriesExecuted).toHaveLength(0);
  });

  it('verifies healthy database on first startup after update and marks verified', () => {
    fakeSafety.state = {
      status: 'pending_verification',
      fromVersion: '1.1.2',
      targetVersion: '1.2.0',
      snapshotPath: '/backups/pre_update.db.gz',
      timestamp: 1000,
    };

    const result = checker.runStartupHealthCheck();

    expect(result.needed).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.state?.status).toBe('verified');
    expect(fakeSafety.state?.status).toBe('verified');
    expect(fakeDb.queriesExecuted).toContain('SELECT count(*) as count FROM projects;');
    expect(fakeDb.queriesExecuted).toContain('SELECT count(*) as count FROM articles;');
    expect(fakeDb.queriesExecuted).toContain('SELECT count(*) as count FROM settings;');
  });

  it('fails verification when PRAGMA quick_check returns false', () => {
    fakeSafety.state = { status: 'pending_verification', fromVersion: '1.1.2', targetVersion: '1.2.0' };
    fakeDb.integrityResult = false;

    const result = checker.runStartupHealthCheck();

    expect(result.needed).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('ERR_HEALTH_INTEGRITY');
    expect(fakeSafety.state?.status).toBe('failed');
  });

  it('fails verification when core tables fail query execution', () => {
    fakeSafety.state = { status: 'pending_verification', fromVersion: '1.1.2', targetVersion: '1.2.0' };
    fakeDb.shouldFailQuery = true;

    const result = checker.runStartupHealthCheck();

    expect(result.needed).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('no such table: projects');
    expect(fakeSafety.state?.status).toBe('failed');
  });
});

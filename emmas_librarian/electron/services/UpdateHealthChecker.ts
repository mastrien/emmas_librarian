import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { UpdateSafetyService } from './UpdateSafetyService';
import type { HealthCheckResult, UpdateStateRecord } from './UpdateTypes';

export type HealthCheckDatabase = Pick<DatabaseAdapter, 'checkIntegrity' | 'getDB'>;
export type HealthCheckSafetyService = Pick<UpdateSafetyService, 'getUpdateState' | 'saveUpdateState'>;

/**
 * Validates database integrity on first startup following an application update.
 *
 * Usage:
 *   const checker = new UpdateHealthChecker(db, safetyService);
 *   const result = checker.runStartupHealthCheck();
 */
export class UpdateHealthChecker {
  constructor(
    private readonly db: HealthCheckDatabase,
    private readonly safetyService: HealthCheckSafetyService,
  ) {}

  /**
   * Evaluates if a post-update verification is needed and runs diagnostic queries.
   *
   * Usage:
   *   const { passed, error } = checker.runStartupHealthCheck();
   */
  public runStartupHealthCheck(): HealthCheckResult {
    const state = this.safetyService.getUpdateState();
    if (!state || state.status !== 'pending_verification') {
      return { needed: false, passed: true, state };
    }

    try {
      this.verifyDatabaseIntegrity();
      this.verifyCoreTables();

      const verifiedState: UpdateStateRecord = { ...state, status: 'verified' };
      this.safetyService.saveUpdateState(verifiedState);
      return { needed: true, passed: true, state: verifiedState };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const failedState: UpdateStateRecord = { ...state, status: 'failed', error: errorMessage };
      this.safetyService.saveUpdateState(failedState);
      return { needed: true, passed: false, error: errorMessage, state: failedState };
    }
  }

  private verifyDatabaseIntegrity(): void {
    const isHealthy = this.db.checkIntegrity();
    if (!isHealthy) {
      throw new Error('[ERR_HEALTH_INTEGRITY] PRAGMA quick_check returned non-ok result.');
    }
  }

  private verifyCoreTables(): void {
    const rawDb = this.db.getDB();
    rawDb.prepare('SELECT count(*) as count FROM projects;').get();
    rawDb.prepare('SELECT count(*) as count FROM articles;').get();
    rawDb.prepare('SELECT count(*) as count FROM settings;').get();
  }
}

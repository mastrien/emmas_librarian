import type Database from 'better-sqlite3';
import type { InvestigationAudit } from '../../src/types';
import type { AuditParams } from '../../src/utils/auditSampling';

const MAX_MIN_PER_QUESTION = 1000;

function requireValidParams(params: AuditParams): void {
  const { seed, samplePercent, minPerQuestion } = params;
  if (!Number.isInteger(seed) || !(samplePercent > 0 && samplePercent <= 100) || !Number.isInteger(minPerQuestion)) {
    throw invalid(params);
  }
  if (minPerQuestion < 1 || minPerQuestion > MAX_MIN_PER_QUESTION) throw invalid(params);
}

function invalid(params: AuditParams): Error {
  return new Error(
    `[ERR_INVALID_AUDIT] Offending value: ${JSON.stringify(params)}. Expected shape: { seed: integer, samplePercent: 0 < n <= 100, minPerQuestion: integer 1-${MAX_MIN_PER_QUESTION} }.`,
  );
}

/**
 * Stores how an investigation was audited (#48): the seed and sizes of its stratified sample. One audit per
 * investigation; drawing again replaces it.
 *
 * Usage:
 *   new InvestigationAuditRepository(db).saveAudit(19, { seed: 48213, samplePercent: 10, minPerQuestion: 2 });
 */
export class InvestigationAuditRepository {
  constructor(private readonly db: Database.Database) {}

  /** The audit of an investigation, or null when it was never audited. */
  getAudit(investigationId: number): InvestigationAudit | null {
    const row = this.db.prepare('SELECT * FROM investigation_audits WHERE investigation_id = ?').get(investigationId);
    return (row as InvestigationAudit | undefined) ?? null;
  }

  /** Creates or replaces the audit of an investigation and returns it as stored. */
  saveAudit(investigationId: number, params: AuditParams): InvestigationAudit {
    requireValidParams(params);
    this.db
      .prepare(
        `INSERT INTO investigation_audits (investigation_id, seed, sample_percent, min_per_question) VALUES (?, ?, ?, ?)
         ON CONFLICT(investigation_id) DO UPDATE SET seed = excluded.seed, sample_percent = excluded.sample_percent,
           min_per_question = excluded.min_per_question, created_at = CURRENT_TIMESTAMP`,
      )
      .run(investigationId, params.seed, params.samplePercent, params.minPerQuestion);
    return this.getAudit(investigationId)!;
  }

  /** Every audit of a project's investigations, for the comparison between models. */
  getAuditsByProject(projectId: number): InvestigationAudit[] {
    return this.db
      .prepare(
        `SELECT a.* FROM investigation_audits a JOIN massive_investigations m ON m.id = a.investigation_id
         WHERE m.project_id = ? ORDER BY a.investigation_id`,
      )
      .all(projectId) as InvestigationAudit[];
  }
}

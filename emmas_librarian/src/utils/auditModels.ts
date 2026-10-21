import type { InvestigationAudit, InvestigationResult } from '../types';
import type { InvestigationHistoryRecord } from '../components/modals/AIExtractionModal';
import { auditStats, drawStratifiedSample, type AuditStats } from './auditSampling';

export interface ModelAuditRow {
  investigationId: number;
  model: string;
  stats: AuditStats;
}

/**
 * The accuracy of every audited investigation of a project, each from its own stored draw, so models compare side by
 * side.
 *
 * Usage:
 *   modelAuditRows(history, audits, resultsById);
 */
export function modelAuditRows(
  history: InvestigationHistoryRecord[],
  audits: InvestigationAudit[],
  resultsById: Map<number, InvestigationResult[]>,
): ModelAuditRow[] {
  return audits.flatMap((audit) => {
    const investigation = history.find((h) => h.id === audit.investigation_id);
    const results = resultsById.get(audit.investigation_id);
    if (!investigation || !results) return [];
    const params = { seed: audit.seed, samplePercent: audit.sample_percent, minPerQuestion: audit.min_per_question };
    const sample = drawStratifiedSample(results, params);
    const sampled = results.filter((r) => sample.has(r.id));
    return [
      {
        investigationId: audit.investigation_id,
        model: investigation.model_used || 'Modelo desconhecido',
        stats: auditStats(sampled),
      },
    ];
  });
}

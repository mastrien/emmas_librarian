import type { InvestigationAudit, InvestigationResult } from '../types';
import { auditStats, drawStratifiedSample, type AuditStats } from './auditSampling';
import { auditQuestionRows } from './auditQuestions';

/** What an export says about the audit of an investigation (#48). */
export interface AuditExport {
  sample: Set<number>;
  seed: number;
  samplePercent: number;
  minPerQuestion: number;
  overall: AuditStats;
  perQuestion: { question: string; stats: AuditStats }[];
}

/**
 * The audit as the CSV/JSON export carries it: which results were drawn, the draw itself (to repeat it) and the
 * accuracy overall and per question. Null when the investigation was never audited.
 *
 * Usage:
 *   const audit = auditForExport(questions, results, await service.getInvestigationAudit(id));
 */
export function auditForExport(
  questions: string[],
  results: InvestigationResult[],
  audit: InvestigationAudit | null,
): AuditExport | null {
  if (!audit) return null;
  const params = { seed: audit.seed, samplePercent: audit.sample_percent, minPerQuestion: audit.min_per_question };
  const sample = drawStratifiedSample(results, params);
  const rows = auditQuestionRows(questions, results, sample);
  return {
    sample,
    ...params,
    overall: auditStats(results.filter((r) => sample.has(r.id))),
    perQuestion: rows
      .filter((row) => row.sampled.length > 0)
      .map((row) => ({ question: row.question, stats: row.stats })),
  };
}

const round = (share: number): number => Math.round(share * 1000) / 1000;

/**
 * The accuracy of an audit group as JSON numbers (shares from 0 to 1, three decimals).
 *
 * Usage:
 *   auditStatsJson(audit.overall); // { sampled: 40, marked: 28, correct: 23, accuracy: 0.821, ci95_low: 0.644, ci95_high: 0.921 }
 */
export function auditStatsJson(stats: AuditStats) {
  const { interval } = stats;
  return {
    sampled: stats.sampled,
    marked: stats.marked,
    correct: stats.correct,
    accuracy: interval ? round(interval.estimate) : null,
    ci95_low: interval ? round(interval.low) : null,
    ci95_high: interval ? round(interval.high) : null,
  };
}

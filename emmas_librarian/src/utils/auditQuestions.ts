import type { InvestigationResult } from '../types';
import { auditStats, type AuditStats } from './auditSampling';

/** One question of an audited investigation: what came back, what was drawn, and the accuracy so far. */
export interface AuditQuestionRow {
  /** 1-based, in the investigation's own order (P1, P2...). */
  number: number;
  question: string;
  answered: number;
  failed: number;
  sampled: InvestigationResult[];
  stats: AuditStats;
}

// The investigation's order first; questions found only in the results (older runs) come after, in reading order.
function orderedQuestions(questions: string[], results: InvestigationResult[]): string[] {
  const order = [...questions];
  for (const result of results) if (!order.includes(result.question)) order.push(result.question);
  return order;
}

/**
 * The rows of the audit table: one per question, with its drawn items in the order they were stored.
 *
 * Usage:
 *   auditQuestionRows(parseJsonList(investigation.questions), results, drawStratifiedSample(results, params));
 */
export function auditQuestionRows(
  questions: string[],
  results: InvestigationResult[],
  sample: Set<number>,
): AuditQuestionRow[] {
  return orderedQuestions(questions, results).map((question, index) => {
    const ofQuestion = results.filter((r) => r.question === question);
    const sampled = ofQuestion.filter((r) => sample.has(r.id)).sort((a, b) => a.id - b.id);
    return {
      number: index + 1,
      question,
      answered: ofQuestion.filter((r) => r.status === 'success').length,
      failed: ofQuestion.filter((r) => r.status !== 'success').length,
      sampled,
      stats: auditStats(sampled),
    };
  });
}

/**
 * The drawn items in table order (question by question), for the review queue and the overall estimate.
 *
 * Usage:
 *   const queue = sampledInOrder(rows).filter((r) => r.review_status === 'pending');
 */
export function sampledInOrder(rows: AuditQuestionRow[]): InvestigationResult[] {
  return rows.flatMap((row) => row.sampled);
}

/**
 * Whole percent for the screen ("82%").
 *
 * Usage:
 *   percent(0.8241); // "82%"
 */
export const percent = (share: number): string => `${Math.round(share * 100)}%`;

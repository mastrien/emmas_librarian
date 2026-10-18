import Database from 'better-sqlite3';
import type { InvestigationResult, ResultReview, ReviewStatus } from '../../src/types';

/** Input shape for saving a single investigation result row. */
export interface InvestigationResultInput {
  question: string;
  answer: string | null;
  quote: string | null;
  status: 'success' | 'error' | 'skipped';
  error_message: string | null;
}

/** Row shape returned from the database: the same contract the renderer reads. */
export type InvestigationResultRow = InvestigationResult;

const REVIEW_STATUSES: readonly ReviewStatus[] = ['pending', 'accepted', 'edited', 'rejected'];

// Only 'edited' keeps the person's text; any other decision clears it, so a stale edit never resurfaces.
function reviewedAnswerOf(review: ResultReview): string | null {
  if (!REVIEW_STATUSES.includes(review.status)) {
    throw new Error(
      `[ERR_INVALID_REVIEW] Unknown review status. Offending value: ${JSON.stringify(review.status)}. Expected shape: one of ${REVIEW_STATUSES.join(', ')}.`,
    );
  }
  if (review.status !== 'edited') return null;
  const answer = review.answer?.trim();
  if (!answer) {
    throw new Error(
      `[ERR_INVALID_REVIEW] An edited answer needs text. Offending value: ${JSON.stringify(review.answer)}. Expected shape: a non-empty string.`,
    );
  }
  return answer;
}

/**
 * Persists and queries per-question results for massive investigations.
 *
 * Usage:
 *   const repo = new InvestigationResultRepository(db);
 *   repo.saveResultsBatch(invId, articleId, results);
 */
export class InvestigationResultRepository {
  private insertStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO investigation_results
        (investigation_id, article_id, question, answer, quote, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
  }

  /** Inserts all results for one article atomically via a transaction. */
  saveResultsBatch(investigationId: number, articleId: number, results: InvestigationResultInput[]): void {
    if (results.length === 0) return;

    const insertMany = this.db.transaction((rows: InvestigationResultInput[]) => {
      for (const r of rows) {
        this.insertStmt.run(investigationId, articleId, r.question, r.answer, r.quote, r.status, r.error_message);
      }
    });

    insertMany(results);
  }

  /** Returns every result row for the given investigation, ordered by article then id. */
  getResultsByInvestigation(investigationId: number): InvestigationResultRow[] {
    return this.db
      .prepare(
        `SELECT * FROM investigation_results
         WHERE investigation_id = ?
         ORDER BY article_id, id`,
      )
      .all(investigationId) as InvestigationResultRow[];
  }

  /** Returns result rows filtered by both investigation and article, ordered by id. */
  getResultsByArticle(investigationId: number, articleId: number): InvestigationResultRow[] {
    return this.db
      .prepare(
        `SELECT * FROM investigation_results
         WHERE investigation_id = ? AND article_id = ?
         ORDER BY id`,
      )
      .all(investigationId, articleId) as InvestigationResultRow[];
  }

  /**
   * Records the person's decision on one AI answer (#47) and returns the updated row. 'pending' undoes a decision.
   *
   * Usage:
   *   repo.reviewResult(42, { status: 'edited', answer: 'Coorte prospectiva' });
   */
  reviewResult(resultId: number, review: ResultReview): InvestigationResultRow {
    const reviewedAnswer = reviewedAnswerOf(review);
    const reviewedAt = review.status === 'pending' ? null : new Date().toISOString();
    const info = this.db
      .prepare('UPDATE investigation_results SET review_status = ?, reviewed_answer = ?, reviewed_at = ? WHERE id = ?')
      .run(review.status, reviewedAnswer, reviewedAt, resultId);
    if (info.changes === 0) {
      throw new Error(
        `[ERR_NOT_FOUND] No investigation result. Offending value: resultId=${resultId}. Expected shape: an existing result id.`,
      );
    }
    return this.db.prepare('SELECT * FROM investigation_results WHERE id = ?').get(resultId) as InvestigationResultRow;
  }

  /** Deletes all result rows belonging to the given investigation. */
  deleteByInvestigation(investigationId: number): void {
    this.db.prepare('DELETE FROM investigation_results WHERE investigation_id = ?').run(investigationId);
  }
}

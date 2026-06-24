import Database from 'better-sqlite3';

/** Input shape for saving a single investigation result row. */
export interface InvestigationResultInput {
  question: string;
  answer: string | null;
  quote: string | null;
  status: 'success' | 'error' | 'skipped';
  error_message: string | null;
}

/** Row shape returned from the database. */
export interface InvestigationResultRow {
  id: number;
  investigation_id: number;
  article_id: number;
  question: string;
  answer: string | null;
  quote: string | null;
  status: 'success' | 'error' | 'skipped';
  error_message: string | null;
  created_at: string;
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
  saveResultsBatch(
    investigationId: number,
    articleId: number,
    results: InvestigationResultInput[],
  ): void {
    if (results.length === 0) return;

    const insertMany = this.db.transaction(
      (rows: InvestigationResultInput[]) => {
        for (const r of rows) {
          this.insertStmt.run(
            investigationId,
            articleId,
            r.question,
            r.answer,
            r.quote,
            r.status,
            r.error_message,
          );
        }
      },
    );

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
  getResultsByArticle(
    investigationId: number,
    articleId: number,
  ): InvestigationResultRow[] {
    return this.db
      .prepare(
        `SELECT * FROM investigation_results
         WHERE investigation_id = ? AND article_id = ?
         ORDER BY id`,
      )
      .all(investigationId, articleId) as InvestigationResultRow[];
  }

  /** Deletes all result rows belonging to the given investigation. */
  deleteByInvestigation(investigationId: number): void {
    this.db
      .prepare('DELETE FROM investigation_results WHERE investigation_id = ?')
      .run(investigationId);
  }
}

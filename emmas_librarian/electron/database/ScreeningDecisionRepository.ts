import type Database from 'better-sqlite3';
import type { Article, ScreeningDecision, ScreeningKind, ScreeningStage } from '../../src/types';
import { archiveNoteFor, isOutKind } from '../../src/utils/screeningPresets';

const STAGES: readonly ScreeningStage[] = ['title', 'full'];
type ArticleStatus = Article['status'];

/** An article's current decision as exports show it. */
export interface ScreeningExportRow {
  article_id: number;
  name: string;
  kind: ScreeningKind;
  stage: ScreeningStage;
  note: string | null;
}

interface EffectiveDecision {
  name: string;
  kind: ScreeningKind;
  note: string | null;
}

function requireStage(stage: ScreeningStage): void {
  if (STAGES.includes(stage)) return;
  throw new Error(`[ERR_INVALID_STAGE] Offending value: ${JSON.stringify(stage)}. Expected shape: 'title' | 'full'.`);
}

/**
 * Screening decisions (#49) and the one rule that ties them to the project page: the decision decides, the
 * article status follows. An exclusion archives the article with the label as reason; taking it back gives the
 * article the status it had ('read' stays read). The full-text decision, when there is one, wins over the
 * title-and-abstract one.
 *
 * Usage:
 *   new ScreeningDecisionRepository(db).decide([3, 4], excludedLabelId, 'title', 'só radar');
 */
export class ScreeningDecisionRepository {
  constructor(private readonly db: Database.Database) {}

  /** Every decision on the project's articles, both stages. */
  listDecisions(projectId: number): ScreeningDecision[] {
    return this.db
      .prepare(
        `SELECT d.* FROM screening_decisions d JOIN articles a ON a.id = d.article_id
         WHERE a.project_id = ? AND a.deleted_at IS NULL ORDER BY d.article_id, d.stage`,
      )
      .all(projectId) as ScreeningDecision[];
  }

  /** Each decided article's current decision (full text over title and abstract), for CSV and XLSX exports. */
  effectiveDecisions(projectId: number): ScreeningExportRow[] {
    return this.db
      .prepare(
        `SELECT d.article_id, l.name, l.kind, d.stage, d.note FROM screening_decisions d
         JOIN screening_labels l ON l.id = d.label_id JOIN articles a ON a.id = d.article_id
         WHERE a.project_id = ? AND NOT (d.stage = 'title' AND EXISTS (
           SELECT 1 FROM screening_decisions f WHERE f.article_id = d.article_id AND f.stage = 'full'))`,
      )
      .all(projectId) as ScreeningExportRow[];
  }

  /** Puts `labelId` on each article at `stage`, replacing what was there. Returns how many were decided. */
  decide(articleIds: number[], labelId: number, stage: ScreeningStage, note: string | null = null): number {
    requireStage(stage);
    const upsert = this.db.prepare(
      `INSERT INTO screening_decisions (article_id, label_id, stage, note) VALUES (?, ?, ?, ?)
       ON CONFLICT(article_id, stage) DO UPDATE SET label_id = excluded.label_id, note = excluded.note,
         decided_at = CURRENT_TIMESTAMP`,
    );
    return this.eachArticle(articleIds, (id) => upsert.run(id, labelId, stage, note || null));
  }

  /** Takes back the decision at `stage`; an article that only the triage had archived comes back. */
  undecide(articleIds: number[], stage: ScreeningStage): number {
    requireStage(stage);
    const remove = this.db.prepare('DELETE FROM screening_decisions WHERE article_id = ? AND stage = ?');
    return this.eachArticle(articleIds, (id) => remove.run(id, stage));
  }

  /**
   * Keeps decisions in step with a status set on the project page: archiving there drops inclusions (the article
   * shows as archived without a label), restoring or marking read there drops exclusions.
   */
  followProjectStatus(articleIds: number[], status: ArticleStatus): void {
    const kinds = status === 'archived' ? "('include', 'maybe')" : "('exclude', 'removed')";
    const drop = this.db.prepare(
      `DELETE FROM screening_decisions WHERE article_id = ?
       AND label_id IN (SELECT id FROM screening_labels WHERE kind IN ${kinds})`,
    );
    const forget = this.db.prepare('UPDATE screening_decisions SET status_before = NULL WHERE article_id = ?');
    this.db.transaction(() => {
      for (const id of articleIds) {
        drop.run(id);
        forget.run(id);
      }
    })();
  }

  /** Writes the archive note again on the articles a label archived, after the label was renamed. */
  refreshArchiveNotes(labelId: number): void {
    const ids = this.db.prepare('SELECT DISTINCT article_id FROM screening_decisions WHERE label_id = ?').all(labelId);
    this.db.transaction(() => (ids as { article_id: number }[]).forEach((r) => this.sync(r.article_id)))();
  }

  /** Re-applies the rule to articles whose decisions changed outside this class (a label moved or deleted). */
  resync(articleIds: number[], statusBefore: Map<number, ArticleStatus | null>): void {
    this.db.transaction(() => articleIds.forEach((id) => this.sync(id, statusBefore.get(id) ?? null)))();
  }

  /** The status a triage exclusion replaced on the article, or null when the triage did not archive it. */
  statusBefore(articleId: number): ArticleStatus | null {
    const row = this.db
      .prepare('SELECT MAX(status_before) AS before FROM screening_decisions WHERE article_id = ?')
      .get(articleId) as { before: ArticleStatus | null };
    return row.before;
  }

  private eachArticle(articleIds: number[], change: (id: number) => unknown): number {
    const run = this.db.transaction((ids: number[]) => {
      for (const id of ids) {
        const before = this.statusBefore(id);
        change(id);
        this.sync(id, before);
      }
      return ids.length;
    });
    return run(articleIds);
  }

  private effective(articleId: number): EffectiveDecision | null {
    const row = this.db
      .prepare(
        `SELECT l.name, l.kind, d.note FROM screening_decisions d JOIN screening_labels l ON l.id = d.label_id
         WHERE d.article_id = ? ORDER BY CASE d.stage WHEN 'full' THEN 0 ELSE 1 END LIMIT 1`,
      )
      .get(articleId);
    return (row as EffectiveDecision | undefined) ?? null;
  }

  private sync(articleId: number, before: ArticleStatus | null = this.statusBefore(articleId)): void {
    const status = this.articleStatus(articleId);
    if (status === null) return;
    const decision = this.effective(articleId);
    if (decision && isOutKind(decision.kind)) return this.archive(articleId, decision, before ?? notArchived(status));
    // An article archived by hand on the project page stays archived until a decision says otherwise.
    if (status === 'archived' && (before !== null || decision !== null)) this.restore(articleId, before ?? 'new');
    this.db.prepare('UPDATE screening_decisions SET status_before = NULL WHERE article_id = ?').run(articleId);
  }

  private archive(articleId: number, decision: EffectiveDecision, before: ArticleStatus | null): void {
    this.db
      .prepare("UPDATE articles SET status = 'archived', archive_note = ? WHERE id = ?")
      .run(archiveNoteFor(decision.name, decision.note), articleId);
    this.db.prepare('UPDATE screening_decisions SET status_before = ? WHERE article_id = ?').run(before, articleId);
  }

  private restore(articleId: number, status: ArticleStatus): void {
    this.db.prepare('UPDATE articles SET status = ?, archive_note = NULL WHERE id = ?').run(status, articleId);
  }

  private articleStatus(articleId: number): ArticleStatus | null {
    const row = this.db.prepare('SELECT status FROM articles WHERE id = ?').get(articleId) as
      | { status: ArticleStatus }
      | undefined;
    return row?.status ?? null;
  }
}

// Excluding an article that was already archived by hand keeps no status to go back to: undoing restores it.
const notArchived = (status: ArticleStatus): ArticleStatus | null => (status === 'archived' ? null : status);

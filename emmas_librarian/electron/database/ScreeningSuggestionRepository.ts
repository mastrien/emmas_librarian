import type Database from 'better-sqlite3';
import type { ScreeningCriteria, ScreeningSuggestion } from '../../src/types/screeningSuggestion';

/** A suggestion as an engine produced it, before it has an id. */
export type ScreeningSuggestionDraft = Omit<ScreeningSuggestion, 'id' | 'created_at'>;

/**
 * The criteria of a project and the suggestions engines made (#54). Nothing here touches a decision.
 *
 * @example new ScreeningSuggestionRepository(db).find(3, 'ollama/llama3.1');
 */
export class ScreeningSuggestionRepository {
  constructor(private readonly db: Database.Database) {}

  criteria(projectId: number): ScreeningCriteria {
    const row = this.db
      .prepare('SELECT screening_inclusion AS inclusion, screening_exclusion AS exclusion FROM projects WHERE id = ?')
      .get(projectId) as { inclusion: string | null; exclusion: string | null } | undefined;
    return { inclusion: row?.inclusion ?? '', exclusion: row?.exclusion ?? '' };
  }

  saveCriteria(projectId: number, { inclusion, exclusion }: ScreeningCriteria): void {
    this.db
      .prepare('UPDATE projects SET screening_inclusion = ?, screening_exclusion = ? WHERE id = ?')
      .run(inclusion, exclusion, projectId);
  }

  /** Every suggestion on the project's articles, of every engine, since the evaluation compares them. */
  listForProject(projectId: number): ScreeningSuggestion[] {
    return this.db
      .prepare(
        `SELECT s.* FROM screening_suggestions s JOIN articles a ON a.id = s.article_id
         WHERE a.project_id = ? AND a.deleted_at IS NULL ORDER BY s.article_id, s.engine`,
      )
      .all(projectId) as ScreeningSuggestion[];
  }

  find(articleId: number, engine: string): ScreeningSuggestion | null {
    const row = this.db
      .prepare('SELECT * FROM screening_suggestions WHERE article_id = ? AND engine = ?')
      .get(articleId, engine) as ScreeningSuggestion | undefined;
    return row ?? null;
  }

  /** Keeps one suggestion per article and engine: a new one, made with other criteria, replaces the old. */
  save(draft: ScreeningSuggestionDraft): ScreeningSuggestion {
    this.db
      .prepare(
        `INSERT INTO screening_suggestions
           (article_id, label_id, engine, criteria, confidence, reason, quote, quote_found, elapsed_ms, tokens_estimated)
         VALUES (@article_id, @label_id, @engine, @criteria, @confidence, @reason, @quote, @quote_found, @elapsed_ms, @tokens_estimated)
         ON CONFLICT(article_id, engine) DO UPDATE SET label_id = excluded.label_id, criteria = excluded.criteria,
           confidence = excluded.confidence, reason = excluded.reason, quote = excluded.quote,
           quote_found = excluded.quote_found, elapsed_ms = excluded.elapsed_ms,
           tokens_estimated = excluded.tokens_estimated, created_at = CURRENT_TIMESTAMP`,
      )
      .run(draft);
    return this.find(draft.article_id, draft.engine) as ScreeningSuggestion;
  }
}

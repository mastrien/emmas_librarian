import { createHash } from 'crypto';
import type Database from 'better-sqlite3';

/** An article whose title and abstract need a vector. */
export interface ArticleToEmbed {
  id: number;
  text: string;
  textHash: string;
}

interface EligibleRow {
  id: number;
  title: string;
  abstract: string | null;
  text_hash: string | null;
}

// What a screening walks: the guided pool at title and abstract. An article archived with no decision is not in it.
const ELIGIBLE_SQL = `
  SELECT a.id, a.title, a.abstract, v.text_hash
  FROM articles a
  LEFT JOIN article_vectors v ON v.article_id = a.id AND v.model = @model
  WHERE a.project_id = @projectId AND a.deleted_at IS NULL
    AND (a.status != 'archived'
      OR EXISTS (SELECT 1 FROM screening_decisions d WHERE d.article_id = a.id AND d.stage = 'title'))
  ORDER BY a.id`;

const textOf = ({ title, abstract }: EligibleRow) => [title, abstract].filter(Boolean).join('\n');

const hashOf = (text: string) => createHash('sha256').update(text).digest('hex');

/**
 * Vectors of title and abstract (#55), one per article and model, so a model's vectors stay valid when the settings go
 * back to it and vectors of different models never meet. Plain rows: the classifier reads them all and needs no search
 * index, so a new size asks for nothing to be cleared.
 *
 * @example new ArticleVectorRepository(db).vectors(3, 'ollama/nomic-embed-text');
 */
export class ArticleVectorRepository {
  constructor(private readonly db: Database.Database) {}

  /** How many articles the project's screening walks. */
  eligibleCount(projectId: number, model: string): number {
    return (this.db.prepare(ELIGIBLE_SQL).all({ projectId, model }) as EligibleRow[]).length;
  }

  /** Those with no vector of this model, or whose title or abstract changed since it was made. */
  needingVector(projectId: number, model: string): ArticleToEmbed[] {
    const rows = this.db.prepare(ELIGIBLE_SQL).all({ projectId, model }) as EligibleRow[];
    return rows
      .map((row) => ({ row, text: textOf(row) }))
      .map(({ row, text }) => ({ id: row.id, text, textHash: hashOf(text), stored: row.text_hash }))
      .filter((article) => article.textHash !== article.stored)
      .map(({ id, text, textHash }) => ({ id, text, textHash }));
  }

  save(articleId: number, model: string, vector: number[], textHash: string): void {
    this.db
      .prepare(
        `INSERT INTO article_vectors (article_id, model, vector, text_hash) VALUES (?, ?, ?, ?)
         ON CONFLICT(article_id, model) DO UPDATE SET vector = excluded.vector, text_hash = excluded.text_hash,
           created_at = CURRENT_TIMESTAMP`,
      )
      .run(articleId, model, Buffer.from(new Float32Array(vector).buffer), textHash);
  }

  /** The project's vectors of this model, by article. */
  vectors(projectId: number, model: string): Map<number, Float32Array> {
    const rows = this.db
      .prepare(
        `SELECT v.article_id, v.vector FROM article_vectors v JOIN articles a ON a.id = v.article_id
         WHERE a.project_id = ? AND a.deleted_at IS NULL AND v.model = ?`,
      )
      .all(projectId, model) as { article_id: number; vector: Buffer }[];
    // Copied: a Buffer may sit at an offset a Float32Array cannot start from.
    return new Map(
      rows.map(({ article_id, vector }) => [
        article_id,
        new Float32Array(vector.buffer.slice(vector.byteOffset, vector.byteOffset + vector.byteLength)),
      ]),
    );
  }

  /** The other model most of the project's vectors came from, if any. */
  mostUsedModelBesides(projectId: number, model: string): string | null {
    const row = this.db
      .prepare(
        `SELECT v.model FROM article_vectors v JOIN articles a ON a.id = v.article_id
         WHERE a.project_id = ? AND v.model != ?
         GROUP BY v.model ORDER BY count(*) DESC, v.model LIMIT 1`,
      )
      .get(projectId, model) as { model: string } | undefined;
    return row?.model ?? null;
  }

  isOrderOn(projectId: number): boolean {
    const row = this.db
      .prepare('SELECT screening_predicted_order AS turnedOn FROM projects WHERE id = ?')
      .get(projectId) as { turnedOn: number | null } | undefined;
    return row?.turnedOn === 1;
  }

  setOrderOn(projectId: number, turnedOn: boolean): void {
    this.db.prepare('UPDATE projects SET screening_predicted_order = ? WHERE id = ?').run(turnedOn ? 1 : 0, projectId);
  }
}

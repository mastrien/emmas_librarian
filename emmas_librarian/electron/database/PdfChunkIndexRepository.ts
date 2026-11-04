import type Database from 'better-sqlite3';
import type { ProjectIndexArticle, ProjectIndexCoverage } from '../../src/types/ask';

interface CoverageRow extends Omit<ProjectIndexArticle, 'pdfPath'> {
  local_file_path: string | null;
  chunks: number;
  embedding_model: string | null;
}

// The ids go as JSON because a project can pass SQLite's limit of bound parameters.
const COVERAGE_SQL = `
  SELECT a.id, a.title, a.authors, a.year, a.local_file_path,
    (SELECT count(*) FROM pdf_chunks c WHERE c.article_id = a.id) AS chunks,
    (SELECT c.embedding_model FROM pdf_chunks c WHERE c.article_id = a.id LIMIT 1) AS embedding_model
  FROM articles a
  WHERE a.deleted_at IS NULL AND a.id IN (SELECT value FROM json_each(?))
  ORDER BY a.id`;

const toArticle = ({ id, title, authors, year, local_file_path }: CoverageRow): ProjectIndexArticle => ({
  id,
  title,
  authors,
  year,
  pdfPath: local_file_path,
});

/**
 * Which articles have their PDF indexed for semantic search, and with which embedding model (#53).
 *
 * @example new PdfChunkIndexRepository(db).coverage([1, 2], 'openai/text-embedding-3-small');
 */
export class PdfChunkIndexRepository {
  constructor(private readonly db: Database.Database) {}

  /** The articles of these projects, without what is in the trash. */
  projectsArticleIds(projectIds: number[]): number[] {
    const rows = this.db
      .prepare(
        `SELECT a.id FROM articles a JOIN projects p ON p.id = a.project_id
         WHERE a.deleted_at IS NULL AND p.deleted_at IS NULL AND p.id IN (SELECT value FROM json_each(?))
         ORDER BY a.id`,
      )
      .all(JSON.stringify(projectIds)) as { id: number }[];
    return rows.map((row) => row.id);
  }

  /**
   * Splits the articles by what a search can read. Only what the current model indexed counts: a PDF of another model,
   * or of an unknown one, is outdated. Without its file it cannot be recalculated, so it joins those without a PDF.
   */
  coverage(articleIds: number[], currentModel: string): ProjectIndexCoverage {
    const rows = this.db.prepare(COVERAGE_SQL).all(JSON.stringify(articleIds)) as CoverageRow[];
    const isCurrent = (row: CoverageRow) => row.chunks > 0 && row.embedding_model === currentModel;
    const left = rows.filter((row) => !isCurrent(row));
    const withFile = left.filter((row) => row.local_file_path);
    return {
      total: rows.length,
      indexed: rows.filter(isCurrent).map(toArticle),
      withoutIndex: withFile.filter((row) => row.chunks === 0).map(toArticle),
      withoutPdf: left.filter((row) => !row.local_file_path).map(toArticle),
      outdated: withFile.filter((row) => row.chunks > 0).map(toArticle),
    };
  }

  /**
   * How many other articles have vectors: those a model of another size would take out of the index.
   *
   * @example repo.indexedArticlesOutside([1, 2]) // 190
   */
  indexedArticlesOutside(articleIds: number[]): number {
    const row = this.db
      .prepare(
        'SELECT count(DISTINCT article_id) AS total FROM pdf_chunks WHERE article_id NOT IN (SELECT value FROM json_each(?))',
      )
      .get(JSON.stringify(articleIds)) as { total: number };
    return row.total;
  }
}

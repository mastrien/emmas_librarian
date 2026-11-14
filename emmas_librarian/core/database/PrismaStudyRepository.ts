import type Database from 'better-sqlite3';
import type { PrismaStudyLink } from '../../src/types';

function invalid(value: unknown, shape: string): Error {
  return new Error(`[ERR_INVALID_PRISMA] Offending value: ${JSON.stringify(value)}. Expected shape: ${shape}.`);
}

/**
 * Publications of the same study (#50): a preprint and the published paper, a conference abstract and the full
 * article. PRISMA 2020 reports included studies and included reports apart; the app counts reports and these
 * links say which of them are one study, so the studies are counted too, never typed. A study is named by its
 * first article: every other publication of it links to that one.
 *
 * Usage:
 *   repo.link(1, preprintId, paperId); // 2 publications, 1 study
 */
export class PrismaStudyRepository {
  constructor(private readonly db: Database.Database) {}

  /** The project's links, publication → the article that names its study. */
  listLinks(projectId: number): PrismaStudyLink[] {
    return this.db
      .prepare(
        `SELECT l.article_id, l.study_article_id FROM prisma_study_links l
         JOIN articles a ON a.id = l.article_id WHERE a.project_id = ? ORDER BY l.article_id`,
      )
      .all(projectId) as PrismaStudyLink[];
  }

  /** Marks two publications as of the same study, joining their studies when each already had others. */
  link(projectId: number, articleId: number, otherId: number): void {
    this.requireArticle(projectId, articleId);
    this.requireArticle(projectId, otherId);
    const study = this.studyOf(articleId);
    const joining = this.studyOf(otherId);
    if (study === joining) return;
    this.db.transaction(() => {
      this.db
        .prepare('UPDATE prisma_study_links SET study_article_id = ? WHERE study_article_id = ?')
        .run(study, joining);
      this.db
        .prepare('INSERT INTO prisma_study_links (article_id, study_article_id) VALUES (?, ?)')
        .run(joining, study);
    })();
  }

  /** Undoes a study: its publications count as one study each again. */
  unlink(projectId: number, studyArticleId: number): void {
    this.requireArticle(projectId, studyArticleId);
    this.db.prepare('DELETE FROM prisma_study_links WHERE study_article_id = ?').run(studyArticleId);
  }

  private studyOf(articleId: number): number {
    const row = this.db
      .prepare('SELECT study_article_id FROM prisma_study_links WHERE article_id = ?')
      .get(articleId) as { study_article_id: number } | undefined;
    return row?.study_article_id ?? articleId;
  }

  private requireArticle(projectId: number, articleId: number): void {
    const found = this.db.prepare('SELECT 1 FROM articles WHERE id = ? AND project_id = ?').get(articleId, projectId);
    if (!found) throw invalid(articleId, `id of an article of project ${projectId}`);
  }
}

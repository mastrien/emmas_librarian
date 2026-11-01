import type Database from 'better-sqlite3';
import type { PrismaArticleOrigin, PrismaSource, PrismaSourceInput, PrismaSourceMethod } from '../../src/types';

const METHODS: readonly PrismaSourceMethod[] = ['citations', 'websites', 'organisations', 'app_projects', 'other'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function invalid(field: string, value: unknown, shape: string): Error {
  return new Error(
    `[ERR_INVALID_PRISMA] Offending value: ${field}=${JSON.stringify(value)}. Expected shape: ${shape}.`,
  );
}

function requireSourceInput(input: PrismaSourceInput): Required<Omit<PrismaSourceInput, 'id'>> {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  if (!name) throw invalid('name', input?.name, 'non-empty text');
  if (!METHODS.includes(input.method)) throw invalid('method', input.method, METHODS.join(' | '));
  const day = input.consulted_on || null;
  if (day !== null && !DAY.test(day)) throw invalid('consulted_on', day, 'YYYY-MM-DD or empty');
  return { name, method: input.method, url: input.url?.trim() || null, consulted_on: day };
}

/**
 * Where the articles from outside the searches came from (#50): the sources a person consulted (a website, a
 * reference list, another project of the app) and one source per article. The PRISMA diagram counts the
 * "other methods" column from these, so nobody types a number.
 *
 * Usage:
 *   const source = repo.saveSource(1, { name: 'Google Scholar', method: 'websites' });
 *   repo.setOrigins(1, [42, 43], source.id);
 */
export class PrismaOriginRepository {
  constructor(private readonly db: Database.Database) {}

  /** The project's sources, oldest first. */
  listSources(projectId: number): PrismaSource[] {
    return this.db
      .prepare(
        'SELECT id, project_id, name, method, url, consulted_on FROM prisma_sources WHERE project_id = ? ORDER BY id',
      )
      .all(projectId) as PrismaSource[];
  }

  /** Where each tagged article of the project came from. */
  listOrigins(projectId: number): PrismaArticleOrigin[] {
    return this.db
      .prepare(
        `SELECT o.article_id, o.source_id FROM prisma_article_origins o
         JOIN prisma_sources s ON s.id = o.source_id WHERE s.project_id = ? ORDER BY o.article_id`,
      )
      .all(projectId) as PrismaArticleOrigin[];
  }

  /** Creates a source, or updates it when the input has the id of one of the project's sources. */
  saveSource(projectId: number, input: PrismaSourceInput): PrismaSource {
    const clean = requireSourceInput(input);
    if (input.id !== undefined) {
      this.requireSource(projectId, input.id);
      this.db
        .prepare('UPDATE prisma_sources SET name = ?, method = ?, url = ?, consulted_on = ? WHERE id = ?')
        .run(clean.name, clean.method, clean.url, clean.consulted_on, input.id);
      return this.requireSource(projectId, input.id);
    }
    const info = this.db
      .prepare('INSERT INTO prisma_sources (project_id, name, method, url, consulted_on) VALUES (?, ?, ?, ?, ?)')
      .run(projectId, clean.name, clean.method, clean.url, clean.consulted_on);
    return this.requireSource(projectId, Number(info.lastInsertRowid));
  }

  /** Tells where the articles came from; null forgets it, so they show as "origem não informada". */
  setOrigins(projectId: number, articleIds: number[], sourceId: number | null): void {
    if (sourceId !== null) this.requireSource(projectId, sourceId);
    const ids = this.requireArticles(projectId, articleIds);
    const forget = this.db.prepare('DELETE FROM prisma_article_origins WHERE article_id = ?');
    const tag = this.db.prepare(
      `INSERT INTO prisma_article_origins (article_id, source_id) VALUES (?, ?)
       ON CONFLICT(article_id) DO UPDATE SET source_id = excluded.source_id`,
    );
    this.db.transaction(() => ids.forEach((id) => (sourceId === null ? forget.run(id) : tag.run(id, sourceId))))();
  }

  /**
   * Tags every article logged by a history entry with a source of that name and method, creating the source
   * the first time. Used when articles are copied from another project, whose origin the app already knows.
   */
  tagSearchEntry(projectId: number, searchId: number, source: Omit<PrismaSourceInput, 'id'>): void {
    const existing = this.listSources(projectId).find((s) => s.name === source.name && s.method === source.method);
    const today = new Date().toISOString().slice(0, 10);
    const sourceId = existing?.id ?? this.saveSource(projectId, { consulted_on: today, ...source }).id;
    const rows = this.db
      .prepare('SELECT id FROM articles WHERE project_id = ? AND search_id = ? AND deleted_at IS NULL')
      .all(projectId, searchId) as { id: number }[];
    this.setOrigins(
      projectId,
      rows.map((r) => r.id),
      sourceId,
    );
  }

  private requireSource(projectId: number, sourceId: number): PrismaSource {
    const source = this.listSources(projectId).find((s) => s.id === sourceId);
    if (!source) throw invalid('source_id', sourceId, `id of a source of project ${projectId}`);
    return source;
  }

  private requireArticles(projectId: number, articleIds: number[]): number[] {
    const own = this.db.prepare('SELECT 1 FROM articles WHERE id = ? AND project_id = ?');
    const wrong = articleIds.find((id) => !own.get(id, projectId));
    if (!Array.isArray(articleIds) || wrong !== undefined) {
      throw invalid('article_id', wrong ?? articleIds, `ids of articles of project ${projectId}`);
    }
    return articleIds;
  }
}

import type { Database } from 'better-sqlite3';
import fs from 'fs';
import { Article } from '../../src/types';
import { ArticleInput } from './DatabaseAdapter';

export class ArticleRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // --- Articles ---
  public findDuplicateArticle(projectId: number, doi: string | null | undefined, title: string): Article | undefined {
    if (doi && doi.trim() !== '') {
      const stmtDoi = this.db.prepare(
        'SELECT * FROM articles WHERE project_id = ? AND doi = ? AND deleted_at IS NULL LIMIT 1',
      );
      const existingByDoi = stmtDoi.get(projectId, doi.trim()) as Article | undefined;
      if (existingByDoi) return existingByDoi;
    }

    const normalizedTarget = this.normalizeTitleForDb(title);
    const stmtTitle = this.db.prepare(
      'SELECT * FROM articles WHERE project_id = ? AND LOWER(title) = LOWER(?) AND deleted_at IS NULL LIMIT 1',
    );
    const directMatch = stmtTitle.get(projectId, normalizedTarget) as Article | undefined;
    if (directMatch) return directMatch;

    const stmt = this.db.prepare('SELECT * FROM articles WHERE project_id = ? AND deleted_at IS NULL');
    const articles = stmt.all(projectId) as Article[];
    return articles.find((art) => this.normalizeTitleForDb(art.title) === normalizedTarget);
  }

  private normalizeTitleForDb(title: string): string {
    if (!title) return '';
    return title
      .replace(/<[^>]*>/g, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private mergeDuplicateArticle(existing: Article, data: ArticleInput): number {
    const existingSources = JSON.parse(existing.source_databases || '[]');
    const newSources = JSON.parse(data.source_databases || '[]');
    const merged = Array.from(new Set([...existingSources, ...newSources]));

    const stmt = this.db.prepare('UPDATE articles SET source_databases = ? WHERE id = ?');
    stmt.run(JSON.stringify(merged), existing.id);
    return existing.id;
  }

  private buildArticleParams(projectId: number, d: ArticleInput) {
    return {
      project_id: projectId,
      doi: d.doi ? d.doi.trim() : null,
      title: d.title,
      authors: d.authors || null,
      year: d.year || null,
      source_query: d.source_query,
      source_databases: d.source_databases,
      csl_json: d.csl_json,
      abstract: d.abstract || null,
      author_keywords: d.author_keywords || null,
      index_keywords: d.index_keywords || null,
      journal: d.journal || null,
      volume: d.volume || null,
      issue: d.issue || null,
      pages: d.pages || null,
      affiliations: d.affiliations || null,
      references_list: d.references_list || null,
      document_type: d.document_type || null,
      issn: d.issn || null,
      citation_count: d.citation_count || null,
      search_id: d.search_id || null,
      is_oa: d.is_oa !== undefined ? d.is_oa : null,
      publisher: d.publisher || null,
      url: d.url || null,
      accessed: d.accessed || null,
    };
  }

  private insertNewArticle(projectId: number, data: ArticleInput): number {
    const stmt = this.db.prepare(`
      INSERT INTO articles (project_id, doi, title, authors, year, source_query, source_databases, csl_json,
        abstract, author_keywords, index_keywords, journal, volume, issue, pages, affiliations, references_list, document_type, issn, citation_count, search_id, is_oa, publisher, url, accessed)
      VALUES (@project_id, @doi, @title, @authors, @year, @source_query, @source_databases, @csl_json,
        @abstract, @author_keywords, @index_keywords, @journal, @volume, @issue, @pages, @affiliations, @references_list, @document_type, @issn, @citation_count, @search_id, @is_oa, @publisher, @url, @accessed)
    `);
    const info = stmt.run(this.buildArticleParams(projectId, data));
    return info.lastInsertRowid as number;
  }

  public saveArticle(projectId: number, data: ArticleInput): number {
    const existing = this.findDuplicateArticle(projectId, data.doi, data.title);
    if (existing) {
      return this.mergeDuplicateArticle(existing, data);
    }
    return this.insertNewArticle(projectId, data);
  }

  public getArticle(id: number): Article | undefined {
    const stmt = this.db.prepare(`
      SELECT a.* FROM articles a
      JOIN projects p ON a.project_id = p.id
      WHERE a.id = ? AND a.deleted_at IS NULL AND p.deleted_at IS NULL
    `);
    return stmt.get(id) as Article | undefined;
  }

  public getArticlesByProject(projectId: number): Article[] {
    const stmt = this.db.prepare(`
      SELECT a.* FROM articles a
      JOIN projects p ON a.project_id = p.id
      WHERE a.project_id = ? AND a.deleted_at IS NULL AND p.deleted_at IS NULL
    `);
    return stmt.all(projectId) as Article[];
  }

  private unlinkFileIfExists(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error('Failed to remove file:', err);
    }
  }

  public updateArticleFilePath(articleId: number, path: string | null): void {
    const existing = this.getArticle(articleId);
    if (existing && existing.local_file_path && existing.local_file_path !== path) {
      this.unlinkFileIfExists(existing.local_file_path);
    }
    const stmt = this.db.prepare('UPDATE articles SET local_file_path = ? WHERE id = ?');
    stmt.run(path, articleId);
  }

  public updateArticleStatus(articleId: number, status: 'new' | 'read' | 'archived', archiveNote?: string): void {
    const stmt = this.db.prepare('UPDATE articles SET status = ?, archive_note = ? WHERE id = ?');
    stmt.run(status, archiveNote || null, articleId);
  }

  public updateArticleMetadata(articleId: number, data: Partial<ArticleInput>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    const allowedFields = [
      'title',
      'authors',
      'year',
      'doi',
      'journal',
      'abstract',
      'volume',
      'issue',
      'pages',
      'url',
      'accessed',
    ];
    for (const field of allowedFields) {
      if (data[field as keyof ArticleInput] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field as keyof ArticleInput] || null);
      }
    }

    if (fields.length === 0) return;

    values.push(articleId);
    const stmt = this.db.prepare(`UPDATE articles SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  public updateArticleAiSummary(articleId: number, summary: string): void {
    const stmt = this.db.prepare('UPDATE articles SET ai_summary = ? WHERE id = ?');
    stmt.run(summary, articleId);
  }

  public deleteArticle(id: number): void {
    const stmt = this.db.prepare("UPDATE articles SET deleted_at = datetime('now') WHERE id = ?");
    stmt.run(id);
  }

  public importArticlesFromProject(
    sourceProjectId: number,
    destProjectId: number,
    articleIds: number[],
    searchHistoryId: number,
  ): void {
    const transaction = this.db.transaction(() => {
      for (const articleId of articleIds) {
        this.cloneArticleToProject(articleId, destProjectId, searchHistoryId);
      }
    });
    transaction();
  }

  private cloneArticleToProject(articleId: number, destProjectId: number, searchHistoryId: number): void {
    const article = this.db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId) as any;
    if (!article) return;
    const info = this.insertClonedArticle(destProjectId, searchHistoryId, article);
    this.clonePdfChunksAndEmbeddings(articleId, info.lastInsertRowid as number);
  }

  private insertClonedArticle(destProjectId: number, searchHistoryId: number, article: any): any {
    const stmt = this.db.prepare(`
      INSERT INTO articles (
        project_id, doi, title, authors, year, abstract, author_keywords, index_keywords,
        journal, volume, issue, pages, affiliations, references_list, document_type,
        publisher, is_oa, url, accessed, csl_json, local_file_path, status, search_id, ai_summary,
        source_query, source_databases, issn, citation_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      destProjectId,
      article.doi || null,
      article.title,
      article.authors || null,
      article.year || null,
      article.abstract || null,
      article.author_keywords || null,
      article.index_keywords || null,
      article.journal || null,
      article.volume || null,
      article.issue || null,
      article.pages || null,
      article.affiliations || null,
      article.references_list || null,
      article.document_type || null,
      article.publisher || null,
      article.is_oa ?? null,
      article.url || null,
      article.accessed || null,
      article.csl_json || null,
      article.local_file_path || null,
      searchHistoryId,
      article.ai_summary || null,
      article.source_query || null,
      article.source_databases || '[]',
      article.issn || null,
      article.citation_count || null,
    );
  }

  private clonePdfChunksAndEmbeddings(oldArticleId: number, newArticleId: number): void {
    const chunks = this.db.prepare('SELECT * FROM pdf_chunks WHERE article_id = ?').all(oldArticleId) as any[];
    for (const chunk of chunks) {
      const info = this.db
        .prepare(
          `
        INSERT INTO pdf_chunks (article_id, chunk_index, text_content, page_number, bbox_x, bbox_y, bbox_w, bbox_h, token_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          newArticleId,
          chunk.chunk_index,
          chunk.text_content,
          chunk.page_number,
          chunk.bbox_x,
          chunk.bbox_y,
          chunk.bbox_w,
          chunk.bbox_h,
          chunk.token_count,
        );
      const newChunkId = BigInt(info.lastInsertRowid);
      const oldChunkId = BigInt(chunk.id);
      const embedding = this.db
        .prepare('SELECT embedding FROM pdf_chunk_embeddings WHERE rowid = ?')
        .get(oldChunkId) as any;
      if (embedding && embedding.embedding) {
        this.db
          .prepare('INSERT INTO pdf_chunk_embeddings (rowid, embedding) VALUES (?, ?)')
          .run(newChunkId, embedding.embedding);
      }
    }
  }
}

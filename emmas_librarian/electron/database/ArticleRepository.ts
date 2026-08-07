import type { Database } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Article, ArticleCategory } from '../../src/types';
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
        'SELECT * FROM articles WHERE project_id = ? AND doi = ? AND deleted_at IS NULL LIMIT 1'
      );
      const existingByDoi = stmtDoi.get(projectId, doi.trim()) as Article | undefined;
      if (existingByDoi) return existingByDoi;
    }

    const normalizedTarget = this.normalizeTitleForDb(title);
    const stmtTitle = this.db.prepare(
      'SELECT * FROM articles WHERE project_id = ? AND LOWER(title) = LOWER(?) AND deleted_at IS NULL LIMIT 1'
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

  // --- Article Categories ---
  public getArticleCategories(articleId: number): ArticleCategory[] {
    const textAndBool = this.db
      .prepare(
        `
      SELECT ac.category_id, ac.value, pc.name, pc.type
      FROM article_categories ac
      JOIN project_categories pc ON ac.category_id = pc.id
      WHERE ac.article_id = ?
    `,
      )
      .all(articleId) as ArticleCategory[];

    const selections = this.db
      .prepare(
        `
      SELECT acs.category_id, acs.option_id, pco.name as option_name, pc.name, pc.type
      FROM article_category_selections acs
      JOIN project_categories pc ON acs.category_id = pc.id
      JOIN project_category_options pco ON acs.option_id = pco.id
      WHERE acs.article_id = ?
    `,
      )
      .all(articleId) as { category_id: number; option_id: number; option_name: string; name: string; type: ArticleCategory['type'] }[];

    const selMap = new Map<number, ArticleCategory & { option_ids: number[]; option_names: string[] }>();
    for (const sel of selections) {
      if (!selMap.has(sel.category_id)) {
        selMap.set(sel.category_id, {
          category_id: sel.category_id,
          name: sel.name,
          type: sel.type,
          option_ids: [],
          option_names: [],
        });
      }
      const entry = selMap.get(sel.category_id)!;
      entry.option_ids.push(sel.option_id);
      entry.option_names.push(sel.option_name);
    }

    for (const entry of selMap.values()) {
      entry.value = entry.option_names.join(', ');
    }

    return [...textAndBool, ...Array.from(selMap.values())];
  }

  public getAllProjectArticleCategories(projectId: number): ArticleCategory[] {
    const textAndBool = this.db
      .prepare(
        `
      SELECT ac.article_id, ac.category_id, ac.value, pc.name, pc.type
      FROM article_categories ac
      JOIN project_categories pc ON ac.category_id = pc.id
      WHERE pc.project_id = ?
    `,
      )
      .all(projectId) as ArticleCategory[];

    const selections = this.db
      .prepare(
        `
      SELECT acs.article_id, acs.category_id, acs.option_id, pco.name as option_name, pc.name, pc.type
      FROM article_category_selections acs
      JOIN project_categories pc ON acs.category_id = pc.id
      JOIN project_category_options pco ON acs.option_id = pco.id
      WHERE pc.project_id = ?
    `,
      )
      .all(projectId) as { article_id: number; category_id: number; option_id: number; option_name: string; name: string; type: ArticleCategory['type'] }[];

    const selMap = new Map<string, ArticleCategory & { article_id: number; option_ids: number[]; option_names: string[] }>();
    for (const sel of selections) {
      const key = `${sel.article_id}-${sel.category_id}`;
      if (!selMap.has(key)) {
        selMap.set(key, {
          article_id: sel.article_id,
          category_id: sel.category_id,
          name: sel.name,
          type: sel.type,
          option_ids: [],
          option_names: [],
        });
      }
      const entry = selMap.get(key)!;
      entry.option_ids.push(sel.option_id);
      entry.option_names.push(sel.option_name);
    }

    for (const entry of selMap.values()) {
      entry.value = entry.option_names.join(', ');
    }

    return [...textAndBool, ...Array.from(selMap.values())];
  }

  public setArticleCategory(articleId: number, categoryId: number, value: string | null): void {
    const pc = this.db.prepare('SELECT type FROM project_categories WHERE id = ?').get(categoryId) as
      | { type: string }
      | undefined;
    if (!pc) return;

    if (pc.type === 'enum' || pc.type === 'multiselect') {
      this.db
        .prepare('DELETE FROM article_category_selections WHERE article_id = ? AND category_id = ?')
        .run(articleId, categoryId);

      let idsToInsert: number[] = [];
      if (Array.isArray(value)) {
        idsToInsert = value.map(Number).filter((n) => !isNaN(n));
      } else if (typeof value === 'string' && value.trim() !== '') {
        const parts = value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const options = this.db
          .prepare('SELECT id, name FROM project_category_options WHERE category_id = ?')
          .all(categoryId) as { id: number; name: string }[];
        for (const p of parts) {
          const exact = options.find((o) => o.name === p || String(o.id) === p);
          if (exact) idsToInsert.push(exact.id);
        }
      }

      const insertStmt = this.db.prepare(
        'INSERT INTO article_category_selections (article_id, category_id, option_id) VALUES (?, ?, ?)',
      );
      for (const optId of idsToInsert) {
        try {
          insertStmt.run(articleId, categoryId, optId);
        } catch (e) {}
      }
    } else {
      if (value === null || value === '') {
        this.db
          .prepare('DELETE FROM article_categories WHERE article_id = ? AND category_id = ?')
          .run(articleId, categoryId);
      } else {
        this.db
          .prepare(
            `
          INSERT INTO article_categories (article_id, category_id, value)
          VALUES (?, ?, ?)
          ON CONFLICT(article_id, category_id) DO UPDATE SET value = excluded.value
        `,
          )
          .run(articleId, categoryId, String(value));
      }
    }
  }

  // --- PDFs ---
  public getStoredPdfs(): unknown[] {
    const query = `
      SELECT p.file_path, p.file_hash, p.filename, p.file_size, p.created_at,
             (SELECT json_group_array(json_object('article_id', a.id, 'article_title', a.title, 'project_id', a.project_id, 'project_name', pr.name))
              FROM articles a
              JOIN projects pr ON a.project_id = pr.id
              WHERE LOWER(REPLACE(a.local_file_path, '/', '\\')) = LOWER(REPLACE(p.file_path, '/', '\\')) AND a.deleted_at IS NULL AND pr.deleted_at IS NULL
             ) as articles_json
      FROM pdf_files p
      ORDER BY p.created_at DESC
    `;
    const rows = this.db.prepare(query).all();
    return rows.map((r: any) => {
      const parsed = r.articles_json ? JSON.parse(r.articles_json) : [];
      const articles = Array.isArray(parsed) ? parsed.filter((art: any) => art && art.article_id != null) : [];
      return {
        ...r,
        articles,
      };
    });
  }

  public getArticlesForPdf(filePath: string): { id: number; title: string; project_id: number }[] {
    const query = 'SELECT id, title, project_id FROM articles WHERE local_file_path = ? AND deleted_at IS NULL';
    return this.db.prepare(query).all(filePath) as any;
  }

  public deletePdfRecord(filePath: string): void {
    this.db.prepare('DELETE FROM pdf_files WHERE file_path = ?').run(filePath);
  }

  public deletePdfLibraryRecord(filePath: string): number[] {
    const articles = this.getArticlesForPdf(filePath);
    const articleIds = articles.map((a) => a.id);
    
    const transaction = this.db.transaction(() => {
      for (const id of articleIds) {
        this.unlinkPdfFromArticle(id);
      }
      this.db.prepare('DELETE FROM pdf_files WHERE file_path = ?').run(filePath);
    });
    transaction();
    return articleIds;
  }

  public unlinkPdfFromArticle(articleId: number): void {
    const article = this.getArticle(articleId);
    if (!article || !article.local_file_path) return;
    
    const chunks = this.db.prepare('SELECT id FROM pdf_chunks WHERE article_id = ?').all(articleId) as { id: number }[];
    const chunkIds = chunks.map((c) => c.id);
    if (chunkIds.length > 0) {
      try {
        this.db.prepare(`DELETE FROM pdf_chunk_embeddings WHERE rowid IN (${chunkIds.join(',')})`).run();
      } catch (e) {}
      this.db.prepare('DELETE FROM pdf_chunks WHERE article_id = ?').run(articleId);
    }

    this.db.prepare('DELETE FROM highlights WHERE article_id = ?').run(articleId);
    this.db.prepare('DELETE FROM annotations WHERE article_id = ?').run(articleId);
    this.db.prepare('UPDATE articles SET local_file_path = NULL WHERE id = ?').run(articleId);
  }

  // --- PDF Library & Article Sharing ---
  public backfillExistingPdfs(): void {
    try {
      const checkBackfill = this.db
        .prepare("SELECT value FROM settings WHERE key = 'backfilled_pdf_files'")
        .get() as { value: string } | undefined;
      if (checkBackfill?.value === 'true') return;
      
      const articles = this.db
        .prepare('SELECT id, local_file_path FROM articles WHERE local_file_path IS NOT NULL')
        .all() as { id: number; local_file_path: string }[];
      for (const art of articles) {
        this.processExistingPdf(art.id, art.local_file_path);
      }
      this.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('backfilled_pdf_files', 'true')").run();
    } catch (e) {
      console.error('Failed to backfill pdf_files:', e);
    }
  }

  private processExistingPdf(articleId: number, filePath: string): void {
    if (!fs.existsSync(filePath)) return;
    try {
      const hash = this.getFileHash(filePath);
      const size = fs.statSync(filePath).size;
      const filename = path.basename(filePath);
      this.insertPdfRecord(filePath, hash, filename, size);
    } catch (e) {
      console.error('Error processing PDF for article:', e);
    }
  }

  private async getFileHashAsync(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  private getFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  private insertPdfRecord(filePath: string, hash: string, filename: string, size: number): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO pdf_files (file_path, file_hash, filename, file_size)
      VALUES (?, ?, ?, ?)
    `).run(filePath, hash, filename, size);
  }

  public linkPdfToArticle(articleId: number, filePath: string): void {
    const normalized = path.normalize(filePath);
    let pdf = this.db.prepare('SELECT * FROM pdf_files WHERE file_path = ?').get(normalized) as any;
    if (!pdf) {
      pdf = this.db.prepare("SELECT * FROM pdf_files WHERE LOWER(REPLACE(file_path, '/', '\\')) = LOWER(REPLACE(?, '/', '\\'))").get(normalized) as any;
    }
    if (!pdf) {
      const filename = path.basename(filePath);
      pdf = this.db.prepare('SELECT * FROM pdf_files WHERE filename = ?').get(filename) as any;
    }
    if (!pdf) {
      throw new Error(`PDF file not found in library: "${filePath}"`);
    }
    this.db.prepare('UPDATE articles SET local_file_path = ? WHERE id = ?').run(pdf.file_path, articleId);
  }

  public registerPdfInLibrary(filePath: string, hash: string, filename: string, size: number): void {
    const normalized = path.normalize(filePath);
    this.db.prepare(`
      INSERT OR REPLACE INTO pdf_files (file_path, file_hash, filename, file_size)
      VALUES (?, ?, ?, ?)
    `).run(normalized, hash, filename, size);
  }

  public importArticlesFromProject(
    sourceProjectId: number,
    destProjectId: number,
    articleIds: number[],
    searchHistoryId: number
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
      destProjectId, article.doi || null, article.title, article.authors || null, article.year || null,
      article.abstract || null, article.author_keywords || null, article.index_keywords || null,
      article.journal || null, article.volume || null, article.issue || null, article.pages || null,
      article.affiliations || null, article.references_list || null, article.document_type || null,
      article.publisher || null, article.is_oa ?? null, article.url || null, article.accessed || null,
      article.csl_json || null, article.local_file_path || null, searchHistoryId, article.ai_summary || null,
      article.source_query || null, article.source_databases || '[]', article.issn || null, article.citation_count || null
    );
  }

  public getPdfByHash(hash: string): any {
    return this.db.prepare('SELECT * FROM pdf_files WHERE file_hash = ?').get(hash);
  }

  private clonePdfChunksAndEmbeddings(oldArticleId: number, newArticleId: number): void {
    const chunks = this.db.prepare('SELECT * FROM pdf_chunks WHERE article_id = ?').all(oldArticleId) as any[];
    for (const chunk of chunks) {
      const info = this.db.prepare(`
        INSERT INTO pdf_chunks (article_id, chunk_index, text_content, page_number, bbox_x, bbox_y, bbox_w, bbox_h, token_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newArticleId, chunk.chunk_index, chunk.text_content, chunk.page_number,
        chunk.bbox_x, chunk.bbox_y, chunk.bbox_w, chunk.bbox_h, chunk.token_count
      );
      const newChunkId = BigInt(info.lastInsertRowid);
      const oldChunkId = BigInt(chunk.id);
      const embedding = this.db.prepare('SELECT embedding FROM pdf_chunk_embeddings WHERE rowid = ?').get(oldChunkId) as any;
      if (embedding && embedding.embedding) {
        this.db.prepare('INSERT INTO pdf_chunk_embeddings (rowid, embedding) VALUES (?, ?)').run(newChunkId, embedding.embedding);
      }
    }
  }
}

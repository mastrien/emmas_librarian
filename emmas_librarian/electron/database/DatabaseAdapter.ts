// @ts-nocheck
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import fs from 'fs';
import path from 'path';
import { safeStorage } from 'electron';
import { Project, Article, Annotation, Highlight, DiaryEntry, ProjectDocument } from '../types';

export interface ArticleInput {
  doi?: string;
  title: string;
  authors?: string;
  year?: number;
  abstract?: string;
  author_keywords?: string;
  index_keywords?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  affiliations?: string;
  references_list?: string;
  document_type?: string;
  issn?: string;
  citation_count?: number;
  source_query: string;
  source_databases: string;
  csl_json: string;
  search_id?: number;
  is_oa?: number;
  publisher?: string;
  url?: string;
  accessed?: string;
}

export type HighlightWithComment = Highlight & { comment?: string };

export class DatabaseAdapter {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.loadSqliteVec(this.db);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private loadSqliteVec(db: Database.Database): void {
    try {
      let loadablePath = sqliteVec.getLoadablePath();
      if (
        loadablePath.toLowerCase().includes('app.asar') &&
        !loadablePath.toLowerCase().includes('app.asar.unpacked')
      ) {
        loadablePath = loadablePath.replace(/app\.asar/i, 'app.asar.unpacked');
      }
      db.loadExtension(loadablePath);
    } catch (err) {
      console.error('Failed to load sqlite-vec extension', err);
    }
  }

  public getDB(): Database.Database {
    return this.db;
  }

  private initSchema() {
    // Determine the right path for schema.sql whether running compiled, in dev, or in tests
    const possiblePaths = [
      path.join(__dirname, 'schema.sql'), // compiled dist-electron/database/schema.sql or test from __dirname
      path.join(__dirname, '..', '..', 'electron', 'database', 'schema.sql'), // from dist-electron (if __dirname is dist-electron)
      path.join(__dirname, '..', '..', '..', 'electron', 'database', 'schema.sql'), // from nested dist-electron/electron/database
      path.join(process.cwd(), 'electron', 'database', 'schema.sql'), // test from frontend root
    ];

    let schemaStr = '';
    let found = false;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        schemaStr = fs.readFileSync(p, 'utf-8');
        found = true;
        break;
      }
    }

    if (!found) throw new Error('Could not find schema.sql. Checked: ' + possiblePaths.join(', '));

    this.db.exec(schemaStr);

    const migrations = [
      'ALTER TABLE articles ADD COLUMN archive_note TEXT',
      'ALTER TABLE articles ADD COLUMN abstract TEXT',
      'ALTER TABLE articles ADD COLUMN author_keywords TEXT',
      'ALTER TABLE articles ADD COLUMN index_keywords TEXT',
      'ALTER TABLE articles ADD COLUMN journal TEXT',
      'ALTER TABLE articles ADD COLUMN volume TEXT',
      'ALTER TABLE articles ADD COLUMN issue TEXT',
      'ALTER TABLE articles ADD COLUMN pages TEXT',
      'ALTER TABLE articles ADD COLUMN affiliations TEXT',
      'ALTER TABLE articles ADD COLUMN references_list TEXT',
      'ALTER TABLE articles ADD COLUMN document_type TEXT',
      'ALTER TABLE articles ADD COLUMN issn TEXT',
      'ALTER TABLE articles ADD COLUMN citation_count INTEGER',
      'ALTER TABLE articles ADD COLUMN search_id INTEGER REFERENCES search_history(id) ON DELETE SET NULL',
      'ALTER TABLE articles ADD COLUMN ai_summary TEXT',
      'ALTER TABLE projects ADD COLUMN writing_pad TEXT',
      'ALTER TABLE articles ADD COLUMN is_oa INTEGER',
      'ALTER TABLE articles ADD COLUMN publisher TEXT',
      'ALTER TABLE articles ADD COLUMN url TEXT',
      'ALTER TABLE articles ADD COLUMN accessed TEXT',
      'ALTER TABLE projects ADD COLUMN deleted_at DATETIME DEFAULT NULL',
      'ALTER TABLE articles ADD COLUMN deleted_at DATETIME DEFAULT NULL',
      'ALTER TABLE annotations ADD COLUMN deleted_at DATETIME DEFAULT NULL',
      `CREATE TABLE IF NOT EXISTS project_diary_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          entry_date TEXT NOT NULL,
          content TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      'ALTER TABLE search_history ADD COLUMN sort_by TEXT',
      'ALTER TABLE search_history ADD COLUMN limit_val INTEGER',
    ];
    for (const sql of migrations) {
      try {
        this.db.exec(sql);
      } catch (e) {
        /* column already exists */
      }
    }

    // One-time backfill of is_oa and publisher columns from csl_json for existing articles
    try {
      const checkBackfill = this.db
        .prepare("SELECT value FROM settings WHERE key = 'backfilled_is_oa_publisher'")
        .get() as { value: string } | undefined;
      if (!checkBackfill || checkBackfill.value !== 'true') {
        const articlesToBackfill = this.db
          .prepare(
            `
          SELECT id, csl_json FROM articles WHERE csl_json IS NOT NULL
        `,
          )
          .all() as { id: number; csl_json: string }[];

        if (articlesToBackfill.length > 0) {
          const updateStmt = this.db.prepare(`
            UPDATE articles SET is_oa = ?, publisher = ? WHERE id = ?
          `);

          const transaction = this.db.transaction((items) => {
            for (const art of items) {
              try {
                const csl = JSON.parse(art.csl_json);
                let isOa = csl.is_oa !== undefined ? (csl.is_oa ? 1 : 0) : null;
                let publisher = csl.publisher || null;
                updateStmt.run(isOa, publisher, art.id);
              } catch (e) {}
            }
          });
          transaction(articlesToBackfill);
        }

        this.db
          .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('backfilled_is_oa_publisher', 'true')")
          .run();
      }
    } catch (err) {
      console.error('Failed to backfill articles is_oa/publisher:', err);
    }

    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS pending_highlights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER NOT NULL,
            quote TEXT NOT NULL,
            context_before TEXT,
            context_after TEXT,
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
        );
      `);
    } catch (e) {
      console.error('Migration pending_highlights error', e);
    }
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS massive_investigations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            questions TEXT NOT NULL,
            articles_ids TEXT NOT NULL,
            model_used TEXT,
            status TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
      `);
    } catch (e) {
      console.error('Migration massive_investigations error', e);
    }

    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS project_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'text',
            options TEXT,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS project_category_options (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY(category_id) REFERENCES project_categories(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS article_categories (
            article_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            value TEXT,
            PRIMARY KEY(article_id, category_id),
            FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
            FOREIGN KEY(category_id) REFERENCES project_categories(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS article_category_selections (
            article_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            option_id INTEGER NOT NULL,
            PRIMARY KEY(article_id, category_id, option_id),
            FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
            FOREIGN KEY(category_id) REFERENCES project_categories(id) ON DELETE CASCADE,
            FOREIGN KEY(option_id) REFERENCES project_category_options(id) ON DELETE CASCADE
        );
      `);

      const pcInfo = this.db.pragma('table_info(project_categories)') as TableInfoRow[];
      if (!pcInfo.some((col) => col.name === 'options')) {
        this.db.exec(`ALTER TABLE project_categories ADD COLUMN options TEXT;`);
      }

      // Migração de dados de options para IDs relacionais
      const checkBackfill = this.db
        .prepare("SELECT value FROM settings WHERE key = 'backfilled_category_options'")
        .get() as { value: string } | undefined;
      if (!checkBackfill || checkBackfill.value !== 'true') {
        const transaction = this.db.transaction(() => {
          const cats = this.db
            .prepare("SELECT id, type, options FROM project_categories WHERE type IN ('enum', 'multiselect')")
            .all() as unknown[];
          const insertOptionStmt = this.db.prepare(
            'INSERT INTO project_category_options (category_id, name) VALUES (?, ?)',
          );
          const insertSelectionStmt = this.db.prepare(
            'INSERT INTO article_category_selections (article_id, category_id, option_id) VALUES (?, ?, ?)',
          );

          for (const cat of cats) {
            if (cat.options) {
              const opts = cat.options
                .split(',')
                .map((o: string) => o.trim())
                .filter(Boolean);
              const optionMap = new Map<string, number>();

              for (const opt of opts) {
                const res = insertOptionStmt.run(cat.id, opt);
                optionMap.set(opt, res.lastInsertRowid as number);
              }

              const assignments = this.db
                .prepare('SELECT article_id, value FROM article_categories WHERE category_id = ?')
                .all(cat.id) as unknown[];
              for (const assign of assignments) {
                if (assign.value) {
                  const selectedOpts = assign.value
                    .split(',')
                    .map((o: string) => o.trim())
                    .filter(Boolean);
                  for (const selected of selectedOpts) {
                    let optId = optionMap.get(selected);
                    if (!optId) {
                      const res = insertOptionStmt.run(cat.id, selected);
                      optId = res.lastInsertRowid as number;
                      optionMap.set(selected, optId);
                    }
                    try {
                      insertSelectionStmt.run(assign.article_id, cat.id, optId);
                    } catch (e) {} // duplicate ignore
                  }
                }
              }
            }
          }
        });
        transaction();
        this.db
          .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('backfilled_category_options', 'true')")
          .run();
      }
    } catch (e) {
      console.error('Migration categories error', e);
    }

    try {
      const checkVecMigration = this.db
        .prepare("SELECT value FROM settings WHERE key = 'migrated_vec_dimensions_v3'")
        .get() as { value: string } | undefined;

      if (!checkVecMigration || checkVecMigration.value !== 'true') {
        const transaction = this.db.transaction(() => {
          this.db.exec(`
            DROP TABLE IF EXISTS pdf_chunk_embeddings;
            DROP TABLE IF EXISTS pdf_chunks;
            CREATE TABLE IF NOT EXISTS pdf_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                article_id INTEGER NOT NULL,
                chunk_index INTEGER NOT NULL,
                text_content TEXT NOT NULL,
                page_number INTEGER NOT NULL,
                bbox_x REAL,
                bbox_y REAL,
                bbox_w REAL,
                bbox_h REAL,
                token_count INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
            );
          `);
        });
        transaction();
        this.db
          .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('migrated_vec_dimensions_v3', 'true')")
          .run();
      }
    } catch (e) {
      console.error('Migration sqlite-vec dimensions error', e);
    }

    try {
      const miInfo = this.db.pragma('table_info(massive_investigations)') as TableInfoRow[];
      if (!miInfo.some((col) => col.name === 'model_used')) {
        this.db.prepare('ALTER TABLE massive_investigations ADD COLUMN model_used TEXT').run();
      }
      if (!miInfo.some((col) => col.name === 'status')) {
        this.db.prepare('ALTER TABLE massive_investigations ADD COLUMN status TEXT').run();
      }

      const hlInfo = this.db.pragma('table_info(highlights)') as TableInfoRow[];
      if (!hlInfo.some((col) => col.name === 'content_text')) {
        this.db.prepare('ALTER TABLE highlights ADD COLUMN content_text TEXT').run();
      }

      // Deduplicate project_diary entries (keep the latest one)
      this.db.exec(`
        DELETE FROM project_diary 
        WHERE id NOT IN (
          SELECT MAX(id) 
          FROM project_diary 
          GROUP BY project_id, entry_date
        );
      `);

      // Enforce unique project_diary entries by index, in case the constraint was missing in older schemas
      this.db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_project_diary_unique 
        ON project_diary(project_id, entry_date);
      `);
    } catch (e) {
      console.error('Schema migrations error', e);
    }
  }

  // Projects
  createProject(name: string): Project {
    const stmt = this.db.prepare('INSERT INTO projects (name, created_at) VALUES (?, ?)');
    const info = stmt.run(name, new Date().toISOString());
    return this.getProject(Number(info.lastInsertRowid)) as Project;
  }

  getProject(id: number): Project | undefined {
    return this.db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL').get(id) as Project | undefined;
  }

  updateProjectWritingPad(id: number, content: string) {
    const stmt = this.db.prepare('UPDATE projects SET writing_pad = ? WHERE id = ?');
    stmt.run(content, id);
  }

  getProjectWritingPad(id: number): string | null {
    const row = this.db.prepare('SELECT writing_pad FROM projects WHERE id = ?').get(id) as { writing_pad?: string };
    return row?.writing_pad || null;
  }

  updateProject(id: number, name: string): void {
    this.db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(name, id);
  }

  deleteProject(id: number): void {
    this.db.prepare("UPDATE projects SET deleted_at = datetime('now') WHERE id = ?").run(id);
  }

  deleteProjectPermanent(id: number): void {
    const transaction = this.db.transaction(() => {
      // 1. Delete articles and their files
      const articles = this.db.prepare('SELECT id, local_file_path FROM articles WHERE project_id = ?').all(id) as {
        id: number;
        local_file_path?: string;
      }[];
      for (const article of articles) {
        this.db.prepare('DELETE FROM highlights WHERE article_id = ?').run(article.id);
        this.db.prepare('DELETE FROM annotations WHERE article_id = ?').run(article.id);
        if (article.local_file_path) {
          try {
            if (fs.existsSync(article.local_file_path)) fs.unlinkSync(article.local_file_path);
          } catch (err) {
            console.error(`Failed to delete physical PDF for article ${article.id}:`, err);
          }
        }
        this.db.prepare('DELETE FROM articles WHERE id = ?').run(article.id);
      }

      // 2. Delete project documents and their files
      const docs = this.db
        .prepare('SELECT id, local_file_path FROM project_documents WHERE project_id = ?')
        .all(id) as { id: number; local_file_path: string }[];
      for (const doc of docs) {
        if (doc.local_file_path) {
          try {
            if (fs.existsSync(doc.local_file_path)) fs.unlinkSync(doc.local_file_path);
          } catch (err) {
            console.error(`Failed to delete document file ${doc.id}:`, err);
          }
        }
        this.db.prepare('DELETE FROM project_documents WHERE id = ?').run(doc.id);
      }

      // 3. Delete other related records
      this.db.prepare('DELETE FROM search_history WHERE project_id = ?').run(id);
      this.db.prepare('DELETE FROM project_diary WHERE project_id = ?').run(id);
      this.db.prepare('DELETE FROM project_diary_history WHERE project_id = ?').run(id);

      // 4. Finally delete the project
      this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    });

    transaction();
  }

  getAllProjects(): Project[] {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC');
    return stmt.all() as Project[];
  }

  findDuplicateArticle(projectId: number, doi: string | null | undefined, title: string): Article | undefined {
    if (doi) {
      const stmt = this.db.prepare('SELECT * FROM articles WHERE project_id = ? AND doi = ? AND deleted_at IS NULL');
      return stmt.get(projectId, doi) as Article | undefined;
    }
    const normalizedTarget = this.normalizeTitleForDb(title);
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
      doi: d.doi || null,
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

  // Articles
  saveArticle(projectId: number, data: ArticleInput): number {
    const existing = this.findDuplicateArticle(projectId, data.doi, data.title);
    if (existing) {
      return this.mergeDuplicateArticle(existing, data);
    }
    return this.insertNewArticle(projectId, data);
  }

  getArticle(id: number): Article | undefined {
    const stmt = this.db.prepare(`
      SELECT a.* FROM articles a
      JOIN projects p ON a.project_id = p.id
      WHERE a.id = ? AND a.deleted_at IS NULL AND p.deleted_at IS NULL
    `);
    return stmt.get(id) as Article | undefined;
  }

  getArticlesByProject(projectId: number): Article[] {
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

  updateArticleFilePath(articleId: number, path: string | null): void {
    const existing = this.getArticle(articleId);
    if (existing && existing.local_file_path && existing.local_file_path !== path) {
      this.unlinkFileIfExists(existing.local_file_path);
    }
    const stmt = this.db.prepare('UPDATE articles SET local_file_path = ? WHERE id = ?');
    stmt.run(path, articleId);
  }

  updateArticleStatus(articleId: number, status: 'new' | 'read' | 'archived', archiveNote?: string): void {
    const stmt = this.db.prepare('UPDATE articles SET status = ?, archive_note = ? WHERE id = ?');
    stmt.run(status, archiveNote || null, articleId);
  }

  updateArticleMetadata(articleId: number, data: Partial<ArticleInput>): void {
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

  updateArticleAiSummary(articleId: number, summary: string): void {
    const stmt = this.db.prepare('UPDATE articles SET ai_summary = ? WHERE id = ?');
    stmt.run(summary, articleId);
  }

  // Annotations
  saveAnnotation(articleId: number, content: string): number {
    const stmt = this.db.prepare('INSERT INTO annotations (article_id, content_markdown) VALUES (?, ?)');
    const info = stmt.run(articleId, content);
    return info.lastInsertRowid as number;
  }

  getAnnotations(articleId: number): Annotation[] {
    const stmt = this.db.prepare(`
      SELECT an.* FROM annotations an
      JOIN articles a ON an.article_id = a.id
      JOIN projects p ON a.project_id = p.id
      WHERE an.article_id = ? AND an.deleted_at IS NULL AND a.deleted_at IS NULL AND p.deleted_at IS NULL
      ORDER BY an.created_at DESC
    `);
    return stmt.all(articleId) as Annotation[];
  }

  updateAnnotation(id: number, content: string): void {
    const stmt = this.db.prepare('UPDATE annotations SET content_markdown = ? WHERE id = ?');
    stmt.run(content, id);
  }

  deleteAnnotation(id: number): void {
    const stmt = this.db.prepare("UPDATE annotations SET deleted_at = datetime('now') WHERE id = ?");
    stmt.run(id);
  }

  // Highlights
  saveHighlight(
    articleId: number,
    color: string,
    positionData: string,
    contentText: string | null,
    annotationId?: number,
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO highlights (article_id, color, position_data, content_text, annotation_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(articleId, color, positionData, contentText, annotationId || null);
    return info.lastInsertRowid as number;
  }

  getHighlights(articleId: number): HighlightWithComment[] {
    const stmt = this.db.prepare(`
      SELECT h.*, a.content_markdown as comment
      FROM highlights h
      JOIN articles art ON h.article_id = art.id
      JOIN projects p ON art.project_id = p.id
      LEFT JOIN annotations a ON h.annotation_id = a.id AND a.deleted_at IS NULL
      WHERE h.article_id = ? AND art.deleted_at IS NULL AND p.deleted_at IS NULL
    `);
    return stmt.all(articleId) as HighlightWithComment[];
  }

  deleteHighlight(id: number): void {
    // If we want to delete a highlight, we should also delete its associated annotation
    const getStmt = this.db.prepare('SELECT annotation_id FROM highlights WHERE id = ?');
    const highlight = getStmt.get(id) as { annotation_id?: number } | undefined;

    const stmt = this.db.prepare('DELETE FROM highlights WHERE id = ?');
    stmt.run(id);

    if (highlight?.annotation_id) {
      this.deleteAnnotation(highlight.annotation_id);
    }
  }

  // Pending Highlights
  savePendingHighlight(
    articleId: number,
    quote: string,
    contextBefore: string,
    contextAfter: string,
    comment: string,
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO pending_highlights (article_id, quote, context_before, context_after, comment)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(articleId, quote, contextBefore, contextAfter, comment);
    return info.lastInsertRowid as number;
  }

  getPendingHighlights(articleId: number): Highlight[] {
    const stmt = this.db.prepare('SELECT * FROM pending_highlights WHERE article_id = ?');
    return stmt.all(articleId);
  }

  deletePendingHighlight(id: number): void {
    const stmt = this.db.prepare('DELETE FROM pending_highlights WHERE id = ?');
    stmt.run(id);
  }

  // Massive Investigations
  saveMassiveInvestigation(
    projectId: number,
    questions: string[],
    articlesIds: number[],
    modelUsed: string,
    status: string,
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO massive_investigations (project_id, questions, articles_ids, model_used, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(projectId, JSON.stringify(questions), JSON.stringify(articlesIds), modelUsed, status);
    return info.lastInsertRowid as number;
  }

  getMassiveInvestigations(projectId: number): unknown[] {
    const stmt = this.db.prepare('SELECT * FROM massive_investigations WHERE project_id = ? ORDER BY created_at DESC');
    return stmt.all(projectId);
  }

  public checkIntegrity(): boolean {
    try {
      const result = this.db.pragma('integrity_check') as unknown[];
      if (!result || result.length === 0) return false;
      const firstRow = result[0];
      const val = firstRow.integrity_check || firstRow['integrity_check'];
      return val === 'ok';
    } catch (e) {
      console.error('Failed to check database integrity:', e);
      return false;
    }
  }

  // Settings
  public getSetting(key: string): string | null {
    let row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (!row) {
      // Fallbacks for scopus and wos keys due to naming inconsistency in settings vs search
      let fallbackKey: string | null = null;
      if (key === 'scopus_api_key') fallbackKey = 'api_key_scopus';
      else if (key === 'api_key_scopus') fallbackKey = 'scopus_api_key';
      else if (key === 'wos_api_key') fallbackKey = 'api_key_wos';
      else if (key === 'api_key_wos') fallbackKey = 'wos_api_key';

      if (fallbackKey) {
        row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(fallbackKey) as
          | { value: string }
          | undefined;
        if (row) {
          key = fallbackKey;
        }
      }
    }
    if (!row) return null;

    if (key.startsWith('api_key_') || key.endsWith('_api_key')) {
      try {
        if (safeStorage.isEncryptionAvailable()) {
          const buffer = Buffer.from(row.value, 'base64');
          return safeStorage.decryptString(buffer);
        }
      } catch (err) {
        console.error(`Failed to decrypt setting ${key}:`, err);
        // Fallback or just return the raw string if it wasn't actually encrypted
        // This handles cases where keys were saved before safeStorage was implemented
        return row.value;
      }
    }
    return row.value;
  }

  public setSetting(key: string, value: string): void {
    let finalValue = value;
    if ((key.startsWith('api_key_') || key.endsWith('_api_key')) && value) {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(value);
        finalValue = encrypted.toString('base64');
      }
    }
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, finalValue);
  }

  // Search History
  public saveSearchHistory(
    projectId: number,
    unifiedQuery: string,
    translatedQueries: Record<string, string>,
    totalResults: number,
    breakdown: Record<string, unknown>,
    sortBy?: string,
    limitVal?: number,
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO search_history (project_id, unified_query, translated_queries, total_results, results_breakdown, sort_by, limit_val, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      projectId,
      unifiedQuery,
      JSON.stringify(translatedQueries),
      totalResults,
      JSON.stringify(breakdown),
      sortBy || null,
      limitVal ?? null,
      new Date().toISOString(),
    );
    return info.lastInsertRowid as number;
  }

  public getSearchHistory(projectId: number): unknown[] {
    const stmt = this.db.prepare('SELECT * FROM search_history WHERE project_id = ? ORDER BY created_at DESC');
    return stmt.all(projectId);
  }

  public revertSearch(searchId: number): void {
    // 1. Get all articles associated with this search
    const stmtArticles = this.db.prepare('SELECT id, local_file_path FROM articles WHERE search_id = ?');
    const articles = stmtArticles.all(searchId) as { id: number; local_file_path?: string }[];

    // 2. Delete all annotations, highlights, physical files and the articles themselves
    for (const article of articles) {
      // Delete highlights first to satisfy potential constraints, then annotations
      this.db.prepare('DELETE FROM highlights WHERE article_id = ?').run(article.id);
      this.db.prepare('DELETE FROM annotations WHERE article_id = ?').run(article.id);

      // Delete physical PDF file
      if (article.local_file_path) {
        try {
          if (fs.existsSync(article.local_file_path)) {
            fs.unlinkSync(article.local_file_path);
          }
        } catch (err) {
          console.error(`Failed to delete physical PDF for article ${article.id}:`, err);
        }
      }

      // Delete the article
      this.db.prepare('DELETE FROM articles WHERE id = ?').run(article.id);
    }

    // 3. Delete the search history entry
    this.db.prepare('DELETE FROM search_history WHERE id = ?').run(searchId);
  }

  // Diary
  public saveDiaryEntry(projectId: number, entryDate: string, content: string): void {
    const existing = this.getDiaryEntry(projectId, entryDate);
    if (existing) {
      this.db
        .prepare(
          `
        INSERT INTO project_diary_history (project_id, entry_date, content)
        VALUES (?, ?, ?)
      `,
        )
        .run(projectId, entryDate, existing.content);
    }

    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO project_diary (project_id, entry_date, content)
      VALUES (?, ?, ?)
    `,
      )
      .run(projectId, entryDate, content);

    // Keep only latest 10 versions in history
    this.db
      .prepare(
        `
      DELETE FROM project_diary_history
      WHERE project_id = ? AND entry_date = ?
        AND id NOT IN (
          SELECT id FROM project_diary_history
          WHERE project_id = ? AND entry_date = ?
          ORDER BY id DESC LIMIT 10
        )
    `,
      )
      .run(projectId, entryDate, projectId, entryDate);
  }

  public getDiaryEntries(projectId: number): DiaryEntry[] {
    return this.db
      .prepare('SELECT * FROM project_diary WHERE project_id = ? ORDER BY entry_date DESC')
      .all(projectId) as DiaryEntry[];
  }

  public getDiaryEntry(projectId: number, entryDate: string): DiaryEntry | undefined {
    return this.db
      .prepare('SELECT * FROM project_diary WHERE project_id = ? AND entry_date = ?')
      .get(projectId, entryDate) as DiaryEntry | undefined;
  }

  public deleteDiaryEntry(projectId: number, entryDate: string): void {
    const existing = this.getDiaryEntry(projectId, entryDate);
    if (existing) {
      this.db
        .prepare(
          `
        INSERT INTO project_diary_history (project_id, entry_date, content)
        VALUES (?, ?, ?)
      `,
        )
        .run(projectId, entryDate, existing.content);

      // Keep only latest 10 versions in history
      this.db
        .prepare(
          `
        DELETE FROM project_diary_history
        WHERE project_id = ? AND entry_date = ?
          AND id NOT IN (
            SELECT id FROM project_diary_history
            WHERE project_id = ? AND entry_date = ?
            ORDER BY id DESC LIMIT 10
          )
      `,
        )
        .run(projectId, entryDate, projectId, entryDate);
    }
    this.db.prepare('DELETE FROM project_diary WHERE project_id = ? AND entry_date = ?').run(projectId, entryDate);
  }

  // Project Documents
  public saveProjectDocument(projectId: number, title: string, url?: string, localFilePath?: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO project_documents (project_id, title, url, local_file_path)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(projectId, title, url || null, localFilePath || null);
    return info.lastInsertRowid as number;
  }

  public getProjectDocuments(projectId: number): ProjectDocument[] {
    const stmt = this.db.prepare('SELECT * FROM project_documents WHERE project_id = ? ORDER BY created_at DESC');
    return stmt.all(projectId) as ProjectDocument[];
  }

  public deleteProjectDocument(id: number): void {
    const stmtGet = this.db.prepare('SELECT local_file_path FROM project_documents WHERE id = ?');
    const doc = stmtGet.get(id) as { local_file_path?: string } | undefined;

    if (doc?.local_file_path) {
      try {
        if (fs.existsSync(doc.local_file_path)) {
          fs.unlinkSync(doc.local_file_path);
        }
      } catch (err) {
        console.error(`Failed to delete physical file for project document ${id}:`, err);
      }
    }

    const stmt = this.db.prepare('DELETE FROM project_documents WHERE id = ?');
    stmt.run(id);
  }

  // Categories
  public getProjectCategories(projectId: number): ProjectCategory[] {
    const cats = this.db.prepare('SELECT * FROM project_categories WHERE project_id = ?').all(projectId) as unknown[];
    for (const cat of cats) {
      if (cat.type === 'enum' || cat.type === 'multiselect') {
        cat.parsedOptions = this.db
          .prepare('SELECT id, name FROM project_category_options WHERE category_id = ? ORDER BY id ASC')
          .all(cat.id);
      }
    }
    return cats;
  }

  public createProjectCategory(projectId: number, name: string, type: string, options?: string | null): number {
    const info = this.db
      .prepare('INSERT INTO project_categories (project_id, name, type) VALUES (?, ?, ?)')
      .run(projectId, name, type);
    const catId = info.lastInsertRowid as number;
    if ((type === 'enum' || type === 'multiselect') && Array.isArray(options)) {
      this.syncProjectCategoryOptions(catId, options);
    } else if (typeof options === 'string') {
      // Legacy support during transition
      this.db.prepare('UPDATE project_categories SET options = ? WHERE id = ?').run(options, catId);
    }
    return catId;
  }

  public updateProjectCategory(categoryId: number, name: string, type: string, options?: string | null): void {
    this.db.prepare('UPDATE project_categories SET name = ?, type = ? WHERE id = ?').run(name, type, categoryId);
    if ((type === 'enum' || type === 'multiselect') && Array.isArray(options)) {
      this.syncProjectCategoryOptions(categoryId, options);
    } else if (typeof options === 'string') {
      this.db.prepare('UPDATE project_categories SET options = ? WHERE id = ?').run(options, categoryId);
    }
  }

  public syncProjectCategoryOptions(categoryId: number, options: { id?: number; name: string }[]): void {
    const existing = this.db
      .prepare('SELECT id FROM project_category_options WHERE category_id = ?')
      .all(categoryId) as { id: number }[];
    const existingIds = new Set(existing.map((e) => e.id));
    const toKeep = new Set<number>();

    const updateStmt = this.db.prepare('UPDATE project_category_options SET name = ? WHERE id = ? AND category_id = ?');
    const insertStmt = this.db.prepare('INSERT INTO project_category_options (category_id, name) VALUES (?, ?)');
    const deleteStmt = this.db.prepare('DELETE FROM project_category_options WHERE id = ? AND category_id = ?');

    const transaction = this.db.transaction(() => {
      for (const opt of options) {
        if (opt.id) {
          updateStmt.run(opt.name, opt.id, categoryId);
          toKeep.add(opt.id);
        } else {
          const res = insertStmt.run(categoryId, opt.name);
          toKeep.add(res.lastInsertRowid as number);
        }
      }

      for (const id of existingIds) {
        if (!toKeep.has(id)) {
          deleteStmt.run(id, categoryId);
        }
      }
    });
    transaction();
  }

  public deleteProjectCategory(categoryId: number): void {
    this.db.prepare('DELETE FROM project_categories WHERE id = ?').run(categoryId);
  }

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
      .all(articleId);

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
      .all(articleId) as unknown[];

    // Group selections by category_id
    const selMap = new Map<number, unknown>();
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
      const entry = selMap.get(sel.category_id);
      entry.option_ids.push(sel.option_id);
      entry.option_names.push(sel.option_name);
    }

    // Compatibility for frontend `value` string
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
      .all(projectId);

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
      .all(projectId) as unknown[];

    const selMap = new Map<string, unknown>();
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
      const entry = selMap.get(key);
      entry.option_ids.push(sel.option_id);
      entry.option_names.push(sel.option_name);
    }

    // Compatibility for frontend `value` string
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
      // value should be an array of option IDs, or a comma-separated string of option IDs/names if legacy
      this.db
        .prepare('DELETE FROM article_category_selections WHERE article_id = ? AND category_id = ?')
        .run(articleId, categoryId);

      let idsToInsert: number[] = [];
      if (Array.isArray(value)) {
        idsToInsert = value.map(Number).filter((n) => !isNaN(n));
      } else if (typeof value === 'string' && value.trim() !== '') {
        // legacy support: try to match by name or id
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

  public deleteArticle(id: number): void {
    const stmt = this.db.prepare("UPDATE articles SET deleted_at = datetime('now') WHERE id = ?");
    stmt.run(id);
  }

  public getTrashItems(): unknown[] {
    const projects = this.db
      .prepare("SELECT id, 'project' as type, name as title, deleted_at FROM projects WHERE deleted_at IS NOT NULL")
      .all();
    const articles = this.db
      .prepare("SELECT id, 'article' as type, title, deleted_at FROM articles WHERE deleted_at IS NOT NULL")
      .all();
    const annotations = this.db
      .prepare(
        "SELECT id, 'annotation' as type, content_markdown as title, deleted_at FROM annotations WHERE deleted_at IS NOT NULL",
      )
      .all();
    return [...projects, ...articles, ...annotations];
  }

  public restoreTrashItem(type: 'project' | 'article' | 'annotation', id: number): void {
    if (type === 'project') {
      this.db.prepare('UPDATE projects SET deleted_at = NULL WHERE id = ?').run(id);
    } else if (type === 'article') {
      this.db.prepare('UPDATE articles SET deleted_at = NULL WHERE id = ?').run(id);
    } else if (type === 'annotation') {
      this.db.prepare('UPDATE annotations SET deleted_at = NULL WHERE id = ?').run(id);
    }
  }

  public deleteTrashItemPermanent(type: 'project' | 'article' | 'annotation', id: number): void {
    if (type === 'project') {
      this.deleteProjectPermanent(id);
    } else if (type === 'article') {
      const article = this.db.prepare('SELECT local_file_path FROM articles WHERE id = ?').get(id) as
        | { local_file_path?: string }
        | undefined;
      if (article) {
        this.db.prepare('DELETE FROM highlights WHERE article_id = ?').run(id);
        this.db.prepare('DELETE FROM annotations WHERE article_id = ?').run(id);
        if (article.local_file_path) {
          try {
            if (fs.existsSync(article.local_file_path)) fs.unlinkSync(article.local_file_path);
          } catch (err) {
            console.error(`Failed to delete physical PDF for article ${id}:`, err);
          }
        }
        this.db.prepare('DELETE FROM articles WHERE id = ?').run(id);
      }
    } else if (type === 'annotation') {
      this.db.prepare('DELETE FROM annotations WHERE id = ?').run(id);
    }
  }

  public emptyTrash(): void {
    const items = this.getTrashItems();
    for (const item of items) {
      this.deleteTrashItemPermanent(item.type, item.id);
    }
  }

  public getDiaryEntryHistory(projectId: number, entryDate: string): unknown[] {
    return this.db
      .prepare('SELECT * FROM project_diary_history WHERE project_id = ? AND entry_date = ? ORDER BY id DESC')
      .all(projectId, entryDate);
  }

  public restoreDiaryEntryVersion(versionId: number): void {
    const hist = this.db.prepare('SELECT * FROM project_diary_history WHERE id = ?').get(versionId) as unknown;
    if (hist) {
      this.saveDiaryEntry(hist.project_id, hist.entry_date, hist.content);
    }
  }

  /**
   * Runs a WAL checkpoint to flush all pending writes from the WAL file into the
   * main database file. Call this before any file-level backup/copy operation to
   * ensure data consistency.
   */
  public checkpoint(): void {
    this.db.pragma('wal_checkpoint(TRUNCATE)');
  }

  public close(): void {
    this.db.close();
  }
}

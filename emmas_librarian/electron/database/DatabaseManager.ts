import Database from 'better-sqlite3';
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
}

export type HighlightWithComment = Highlight & { comment?: string };

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private initSchema() {
    // Determine the right path for schema.sql whether running compiled, in dev, or in tests
    const possiblePaths = [
      path.join(__dirname, 'schema.sql'), // compiled dist-electron/database/schema.sql or test from __dirname
      path.join(__dirname, '..', '..', 'electron', 'database', 'schema.sql'), // from dist-electron (if __dirname is dist-electron)
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
    
    if (!found) throw new Error("Could not find schema.sql. Checked: " + possiblePaths.join(', '));

    this.db.exec(schemaStr);

    // Migrations — add columns that may not exist in older databases
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
    ];
    for (const sql of migrations) {
      try { this.db.exec(sql); } catch (e) { /* column already exists */ }
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
      `);
    } catch (e) {
      console.error('Migration massive_investigations error', e);
    }
    
    // Migrations for existing tables
    try {
      const miInfo = this.db.pragma('table_info(massive_investigations)') as any[];
      if (!miInfo.some(col => col.name === 'model_used')) {
        this.db.prepare('ALTER TABLE massive_investigations ADD COLUMN model_used TEXT').run();
      }
      if (!miInfo.some(col => col.name === 'status')) {
        this.db.prepare('ALTER TABLE massive_investigations ADD COLUMN status TEXT').run();
      }

      const hlInfo = this.db.pragma('table_info(highlights)') as any[];
      if (!hlInfo.some(col => col.name === 'content_text')) {
        this.db.prepare('ALTER TABLE highlights ADD COLUMN content_text TEXT').run();
      }
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
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    return stmt.get(id) as Project | undefined;
  }

  updateProject(id: number, name: string): void {
    this.db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(name, id);
  }

  deleteProject(id: number): void {
    const transaction = this.db.transaction(() => {
      // 1. Delete articles and their files
      const articles = this.db.prepare('SELECT id, local_file_path FROM articles WHERE project_id = ?').all(id) as { id: number, local_file_path?: string }[];
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
      const docs = this.db.prepare('SELECT id, local_file_path FROM project_documents WHERE project_id = ?').all(id) as { id: number, local_file_path: string }[];
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

      // 4. Finally delete the project
      this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    });

    transaction();
  }

  getAllProjects(): Project[] {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
    return stmt.all() as Project[];
  }

  // Articles
  saveArticle(projectId: number, data: ArticleInput): number {
    const stmt = this.db.prepare(`
      INSERT INTO articles (project_id, doi, title, authors, year, source_query, source_databases, csl_json,
        abstract, author_keywords, index_keywords, journal, volume, issue, pages, affiliations, references_list, document_type, issn, citation_count, search_id)
      VALUES (@project_id, @doi, @title, @authors, @year, @source_query, @source_databases, @csl_json,
        @abstract, @author_keywords, @index_keywords, @journal, @volume, @issue, @pages, @affiliations, @references_list, @document_type, @issn, @citation_count, @search_id)
    `);
    const info = stmt.run({
      project_id: projectId,
      doi: data.doi || null,
      title: data.title,
      authors: data.authors || null,
      year: data.year || null,
      source_query: data.source_query,
      source_databases: data.source_databases,
      csl_json: data.csl_json,
      abstract: data.abstract || null,
      author_keywords: data.author_keywords || null,
      index_keywords: data.index_keywords || null,
      journal: data.journal || null,
      volume: data.volume || null,
      issue: data.issue || null,
      pages: data.pages || null,
      affiliations: data.affiliations || null,
      references_list: data.references_list || null,
      document_type: data.document_type || null,
      issn: data.issn || null,
      citation_count: data.citation_count || null,
      search_id: data.search_id || null,
    });
    return info.lastInsertRowid as number;
  }

  getArticle(id: number): Article | undefined {
    const stmt = this.db.prepare('SELECT * FROM articles WHERE id = ?');
    return stmt.get(id) as Article | undefined;
  }

  getArticlesByProject(projectId: number): Article[] {
    const stmt = this.db.prepare('SELECT * FROM articles WHERE project_id = ?');
    return stmt.all(projectId) as Article[];
  }

  updateArticleFilePath(articleId: number, path: string | null): void {
    const stmt = this.db.prepare('UPDATE articles SET local_file_path = ? WHERE id = ?');
    stmt.run(path, articleId);
  }

  updateArticleStatus(articleId: number, status: 'new' | 'read' | 'archived', archiveNote?: string): void {
    const stmt = this.db.prepare('UPDATE articles SET status = ?, archive_note = ? WHERE id = ?');
    stmt.run(status, archiveNote || null, articleId);
  }

  updateArticleMetadata(articleId: number, data: Partial<ArticleInput>): void {
    const fields: string[] = [];
    const values: any[] = [];

    const allowedFields = ['title', 'authors', 'year', 'doi', 'journal', 'abstract'];
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
    const stmt = this.db.prepare('SELECT * FROM annotations WHERE article_id = ? ORDER BY created_at DESC');
    return stmt.all(articleId) as Annotation[];
  }

  updateAnnotation(id: number, content: string): void {
    const stmt = this.db.prepare('UPDATE annotations SET content_markdown = ? WHERE id = ?');
    stmt.run(content, id);
  }

  deleteAnnotation(id: number): void {
    const stmt = this.db.prepare('DELETE FROM annotations WHERE id = ?');
    stmt.run(id);
  }

  // Highlights
  saveHighlight(articleId: number, color: string, positionData: string, contentText: string | null, annotationId?: number): number {
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
      LEFT JOIN annotations a ON h.annotation_id = a.id
      WHERE h.article_id = ?
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
  savePendingHighlight(articleId: number, quote: string, contextBefore: string, contextAfter: string, comment: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO pending_highlights (article_id, quote, context_before, context_after, comment)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(articleId, quote, contextBefore, contextAfter, comment);
    return info.lastInsertRowid as number;
  }

  getPendingHighlights(articleId: number): any[] {
    const stmt = this.db.prepare('SELECT * FROM pending_highlights WHERE article_id = ?');
    return stmt.all(articleId);
  }

  deletePendingHighlight(id: number): void {
    const stmt = this.db.prepare('DELETE FROM pending_highlights WHERE id = ?');
    stmt.run(id);
  }

  // Massive Investigations
  saveMassiveInvestigation(projectId: number, questions: string[], articlesIds: number[], modelUsed: string, status: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO massive_investigations (project_id, questions, articles_ids, model_used, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(projectId, JSON.stringify(questions), JSON.stringify(articlesIds), modelUsed, status);
    return info.lastInsertRowid as number;
  }

  getMassiveInvestigations(projectId: number): any[] {
    const stmt = this.db.prepare('SELECT * FROM massive_investigations WHERE project_id = ? ORDER BY created_at DESC');
    return stmt.all(projectId);
  }

  close(): void {
    this.db.close();
  }

  // Settings
  public getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
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
  public saveSearchHistory(projectId: number, unifiedQuery: string, translatedQueries: Record<string, string>, totalResults: number, breakdown: Record<string, any>): number {
    const stmt = this.db.prepare(`
      INSERT INTO search_history (project_id, unified_query, translated_queries, total_results, results_breakdown, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      projectId, 
      unifiedQuery, 
      JSON.stringify(translatedQueries), 
      totalResults, 
      JSON.stringify(breakdown),
      new Date().toISOString()
    );
    return info.lastInsertRowid as number;
  }

  public getSearchHistory(projectId: number): any[] {
    const stmt = this.db.prepare('SELECT * FROM search_history WHERE project_id = ? ORDER BY created_at DESC');
    return stmt.all(projectId);
  }

  public revertSearch(searchId: number): void {
    // 1. Get all articles associated with this search
    const stmtArticles = this.db.prepare('SELECT id, local_file_path FROM articles WHERE search_id = ?');
    const articles = stmtArticles.all(searchId) as { id: number, local_file_path?: string }[];
    
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
    this.db.prepare(`
      INSERT OR REPLACE INTO project_diary (project_id, entry_date, content)
      VALUES (?, ?, ?)
    `).run(projectId, entryDate, content);
  }

  public getDiaryEntries(projectId: number): DiaryEntry[] {
    return this.db.prepare('SELECT * FROM project_diary WHERE project_id = ? ORDER BY entry_date DESC').all(projectId) as DiaryEntry[];
  }

  public getDiaryEntry(projectId: number, entryDate: string): DiaryEntry | undefined {
    return this.db.prepare('SELECT * FROM project_diary WHERE project_id = ? AND entry_date = ?').get(projectId, entryDate) as DiaryEntry | undefined;
  }

  public deleteDiaryEntry(projectId: number, entryDate: string): void {
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
}

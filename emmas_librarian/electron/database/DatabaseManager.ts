import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Project, Article, Annotation, Highlight, DiaryEntry } from '../types';

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
    ];
    for (const sql of migrations) {
      try { this.db.exec(sql); } catch (e) { /* column already exists */ }
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
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
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
  saveHighlight(articleId: number, color: string, positionData: string, annotationId?: number): number {
    const stmt = this.db.prepare(`
      INSERT INTO highlights (article_id, color, position_data, annotation_id)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(articleId, color, positionData, annotationId || null);
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

  close(): void {
    this.db.close();
  }

  // Settings
  public getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
    return row ? row.value : null;
  }

  public setSetting(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
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
}

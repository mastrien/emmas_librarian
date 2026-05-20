import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Project, Article, Annotation, Highlight } from '../types';

export interface ArticleInput {
  doi?: string;
  title: string;
  authors?: string;
  year?: number;
  source_query: string;
  source_databases: string;
  csl_json: string;
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

    try {
      this.db.exec('ALTER TABLE articles ADD COLUMN archive_note TEXT');
    } catch (e) {
      // Ignore if it already exists
    }
  }

  // Projects
  createProject(name: string): Project {
    const stmt = this.db.prepare('INSERT INTO projects (name) VALUES (?)');
    const info = stmt.run(name);
    return this.getProject(info.lastInsertRowid as number)!;
  }

  getProject(id: number): Project | undefined {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    return stmt.get(id) as Project | undefined;
  }

  getAllProjects(): Project[] {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
    return stmt.all() as Project[];
  }

  // Articles
  saveArticle(projectId: number, data: ArticleInput): number {
    const stmt = this.db.prepare(`
      INSERT INTO articles (project_id, doi, title, authors, year, source_query, source_databases, csl_json)
      VALUES (@project_id, @doi, @title, @authors, @year, @source_query, @source_databases, @csl_json)
    `);
    const info = stmt.run({
      project_id: projectId,
      doi: data.doi || null,
      title: data.title,
      authors: data.authors || null,
      year: data.year || null,
      source_query: data.source_query,
      source_databases: data.source_databases,
      csl_json: data.csl_json
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

  updateArticleFilePath(articleId: number, path: string): void {
    const stmt = this.db.prepare('UPDATE articles SET local_file_path = ? WHERE id = ?');
    stmt.run(path, articleId);
  }

  updateArticleStatus(articleId: number, status: 'new' | 'read' | 'archived', archiveNote?: string): void {
    const stmt = this.db.prepare('UPDATE articles SET status = ?, archive_note = ? WHERE id = ?');
    stmt.run(status, archiveNote || null, articleId);
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
}

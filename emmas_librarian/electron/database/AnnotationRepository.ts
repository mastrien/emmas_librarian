import type { Database } from 'better-sqlite3';
import { Annotation, Highlight } from '../../src/types';
import { HighlightWithComment } from './DatabaseAdapter';

export class AnnotationRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // --- Annotations ---
  public saveAnnotation(articleId: number, content: string): number {
    const stmt = this.db.prepare('INSERT INTO annotations (article_id, content_markdown) VALUES (?, ?)');
    const info = stmt.run(articleId, content);
    return info.lastInsertRowid as number;
  }

  public getAnnotations(articleId: number): Annotation[] {
    const stmt = this.db.prepare(`
      SELECT an.* FROM annotations an
      JOIN articles a ON an.article_id = a.id
      JOIN projects p ON a.project_id = p.id
      WHERE an.article_id = ? AND an.deleted_at IS NULL AND a.deleted_at IS NULL AND p.deleted_at IS NULL
      ORDER BY an.created_at DESC
    `);
    return stmt.all(articleId) as Annotation[];
  }

  public updateAnnotation(id: number, content: string): void {
    const stmt = this.db.prepare('UPDATE annotations SET content_markdown = ? WHERE id = ?');
    stmt.run(content, id);
  }

  public deleteAnnotation(id: number): void {
    const stmt = this.db.prepare("UPDATE annotations SET deleted_at = datetime('now') WHERE id = ?");
    stmt.run(id);
  }

  // --- Highlights ---
  public saveHighlight(
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

  public getHighlights(articleId: number): HighlightWithComment[] {
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

  public deleteHighlight(id: number): void {
    const getStmt = this.db.prepare('SELECT annotation_id FROM highlights WHERE id = ?');
    const highlight = getStmt.get(id) as { annotation_id?: number } | undefined;

    const stmt = this.db.prepare('DELETE FROM highlights WHERE id = ?');
    stmt.run(id);

    if (highlight?.annotation_id) {
      this.deleteAnnotation(highlight.annotation_id);
    }
  }

  // --- Pending Highlights ---
  public savePendingHighlight(
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

  public getPendingHighlights(articleId: number): Highlight[] {
    const stmt = this.db.prepare('SELECT * FROM pending_highlights WHERE article_id = ?');
    return stmt.all(articleId) as Highlight[];
  }

  public deletePendingHighlight(id: number): void {
    const stmt = this.db.prepare('DELETE FROM pending_highlights WHERE id = ?');
    stmt.run(id);
  }
}

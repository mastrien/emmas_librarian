import type { Database } from 'better-sqlite3';
import { DiaryEntry } from '../../src/types';
import fs from 'fs';

export class HistoryRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // --- Search History ---
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
      this.db.prepare('DELETE FROM highlights WHERE article_id = ?').run(article.id);
      this.db.prepare('DELETE FROM annotations WHERE article_id = ?').run(article.id);

      if (article.local_file_path) {
        try {
          if (fs.existsSync(article.local_file_path)) {
            fs.unlinkSync(article.local_file_path);
          }
        } catch (err) {
          console.error(`Failed to delete physical PDF for article ${article.id}:`, err);
        }
      }
      this.db.prepare('DELETE FROM articles WHERE id = ?').run(article.id);
    }

    // 3. Delete the search history entry
    this.db.prepare('DELETE FROM search_history WHERE id = ?').run(searchId);
  }

  // --- Diary ---
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

  public getDiaryEntryHistory(projectId: number, entryDate: string): unknown[] {
    return this.db
      .prepare('SELECT * FROM project_diary_history WHERE project_id = ? AND entry_date = ? ORDER BY id DESC')
      .all(projectId, entryDate);
  }

  public restoreDiaryEntryVersion(versionId: number): void {
    const hist = this.db.prepare('SELECT * FROM project_diary_history WHERE id = ?').get(versionId) as { project_id: number; entry_date: string; content: string } | undefined;
    if (hist) {
      this.saveDiaryEntry(hist.project_id, hist.entry_date, hist.content);
    }
  }
}

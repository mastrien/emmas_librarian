import type { Database } from 'better-sqlite3';
import { Annotation, Highlight, ProjectDocument } from '../../src/types';
import { HighlightWithComment } from './DatabaseAdapter';
import fs from 'fs';

export class DocumentRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // --- Project Documents ---
  private fetchNextDocumentPosition(projectId: number): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM project_documents WHERE project_id = ?')
      .get(projectId) as { next_pos: number } | undefined;
    return row!.next_pos;
  }

  public saveProjectDocument(
    projectId: number,
    title: string,
    url?: string | null,
    localFilePath?: string | null,
    category?: string | null,
  ): number {
    const nextPos = this.fetchNextDocumentPosition(projectId);
    const cleanProjectId = typeof projectId === 'number' ? projectId : Number(projectId);
    const cleanTitle = title && typeof title === 'string' ? title.trim() : '';
    const cleanUrl = url && typeof url === 'string' && url.trim() ? url.trim() : null;
    const cleanFilePath = localFilePath && typeof localFilePath === 'string' && localFilePath.trim() ? localFilePath.trim() : null;
    const cleanCategory = category && typeof category === 'string' && category.trim() ? category.trim() : null;

    const stmt = this.db.prepare(`
      INSERT INTO project_documents (project_id, title, url, local_file_path, position, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(cleanProjectId, cleanTitle, cleanUrl, cleanFilePath, nextPos, cleanCategory);
    return info.lastInsertRowid as number;
  }

  public getProjectDocuments(projectId: number): ProjectDocument[] {
    const stmt = this.db.prepare('SELECT * FROM project_documents WHERE project_id = ? ORDER BY position ASC, id ASC');
    return stmt.all(projectId) as ProjectDocument[];
  }

  public updateProjectDocument(
    id: number,
    title: string,
    url: string | null,
    localFilePath: string | null,
    category: string | null,
  ): void {
    const stmt = this.db.prepare(`
      UPDATE project_documents
      SET title = ?, url = ?, local_file_path = ?, category = ?
      WHERE id = ?
    `);
    stmt.run(title ?? '', url ?? null, localFilePath ?? null, category ?? null, id);
  }

  public reorderProjectDocuments(projectId: number, orderedIds: number[]): void {
    const validIds = Array.isArray(orderedIds)
      ? orderedIds.filter((i) => i !== undefined && i !== null && !isNaN(Number(i))).map(Number)
      : [];
    const cleanProjectId = typeof projectId === 'number' ? projectId : Number(projectId);
    const stmt = this.db.prepare('UPDATE project_documents SET position = ? WHERE id = ? AND project_id = ?');
    const transaction = this.db.transaction((ids: number[]) => {
      ids.forEach((id, index) => {
        stmt.run(index, id, cleanProjectId);
      });
    });
    transaction(validIds);
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

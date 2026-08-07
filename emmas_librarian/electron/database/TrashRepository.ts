import type { Database } from 'better-sqlite3';
import { ProjectRepository } from './ProjectRepository';
import fs from 'fs';

export class TrashRepository {
  private db: Database;
  private projectRepo: ProjectRepository;

  constructor(db: Database, projectRepo: ProjectRepository) {
    this.db = db;
    this.projectRepo = projectRepo;
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
      this.projectRepo.deleteProjectPermanent(id);
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
    const items = this.getTrashItems() as { id: number; type: 'project' | 'article' | 'annotation' }[];
    for (const item of items) {
      this.deleteTrashItemPermanent(item.type, item.id);
    }
  }
}

import type { Database } from 'better-sqlite3';
import { Project, ProjectCategory, CategoryOption } from '../../src/types';
import fs from 'fs';

export class ProjectRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

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

  getProjectCategories(projectId: number): ProjectCategory[] {
    const cats = this.db
      .prepare('SELECT * FROM project_categories WHERE project_id = ?')
      .all(projectId) as ProjectCategory[];

    for (const cat of cats) {
      if (cat.type === 'enum' || cat.type === 'multiselect') {
        const opts = this.db
          .prepare('SELECT * FROM project_category_options WHERE category_id = ?')
          .all(cat.id) as CategoryOption[];
        cat.parsedOptions = opts;
      }
    }
    return cats;
  }

  createProjectCategory(projectId: number, name: string, type: 'text' | 'enum' | 'multiselect', options?: any): number {
    const stmt = this.db.prepare('INSERT INTO project_categories (project_id, name, type) VALUES (?, ?, ?)');
    const info = stmt.run(projectId, name, type);
    const categoryId = info.lastInsertRowid as number;
    if ((type === 'enum' || type === 'multiselect') && Array.isArray(options)) {
      this.syncProjectCategoryOptions(categoryId, options);
    } else if (typeof options === 'string') {
      this.db.prepare('UPDATE project_categories SET options = ? WHERE id = ?').run(options, categoryId);
    }
    return categoryId;
  }

  deleteProjectCategory(categoryId: number): void {
    const stmt = this.db.prepare('DELETE FROM project_categories WHERE id = ?');
    stmt.run(categoryId);
  }

  addProjectCategoryOption(categoryId: number, name: string): void {
    const stmt = this.db.prepare('INSERT INTO project_category_options (category_id, name) VALUES (?, ?)');
    stmt.run(categoryId, name);
  }

  removeProjectCategoryOption(optionId: number): void {
    const stmt = this.db.prepare('DELETE FROM project_category_options WHERE id = ?');
    stmt.run(optionId);
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
}

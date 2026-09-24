import type { Database } from 'better-sqlite3';
import { ArticleCategory } from '../../src/types';

/**
 * Per-article values of the project's custom categories (text/boolean values and enum/multiselect options).
 *
 * Usage:
 *   new ArticleCategoryRepository(db).setArticleCategory(articleId, categoryId, 'Survey');
 */
export class ArticleCategoryRepository {
  constructor(private db: Database) {}

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
      .all(articleId) as {
      category_id: number;
      option_id: number;
      option_name: string;
      name: string;
      type: ArticleCategory['type'];
    }[];

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
      .all(projectId) as {
      article_id: number;
      category_id: number;
      option_id: number;
      option_name: string;
      name: string;
      type: ArticleCategory['type'];
    }[];

    const selMap = new Map<
      string,
      ArticleCategory & { article_id: number; option_ids: number[]; option_names: string[] }
    >();
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
        } catch {
          // The same option may be listed twice; the (article, category, option) primary key keeps one row.
        }
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
}

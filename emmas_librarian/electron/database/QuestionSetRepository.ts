import Database from 'better-sqlite3';
import { QuestionSet } from '../types';

export class QuestionSetRepository {
  constructor(private db: Database.Database) {}

  hasDuplicate(name: string, projectId: number | null): boolean {
    const query =
      projectId === null
        ? 'SELECT 1 FROM question_sets WHERE name = ? AND project_id IS NULL'
        : 'SELECT 1 FROM question_sets WHERE name = ? AND project_id = ?';
    const stmt = this.db.prepare(query);
    const result = projectId === null ? stmt.get(name) : stmt.get(name, projectId);
    return result !== undefined;
  }

  createQuestionSet(data: {
    project_id: number | null;
    name: string;
    description?: string;
    questions: string;
  }): QuestionSet {
    if (this.hasDuplicate(data.name, data.project_id)) {
      throw new Error(`Question set with name "${data.name}" already exists in this project`);
    }
    const stmt = this.db.prepare(`
      INSERT INTO question_sets (project_id, name, description, questions)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(data.project_id, data.name, data.description || null, data.questions);
    return this.getQuestionSet(info.lastInsertRowid as number) as QuestionSet;
  }

  getQuestionSet(id: number): QuestionSet | undefined {
    const stmt = this.db.prepare('SELECT * FROM question_sets WHERE id = ?');
    return stmt.get(id) as QuestionSet | undefined;
  }

  listQuestionSets(projectId: number | null, limit?: number, offset?: number): QuestionSet[] {
    const hasLimit = typeof limit === 'number';
    const sql =
      projectId === null
        ? `SELECT * FROM question_sets WHERE project_id IS NULL ORDER BY name ASC${hasLimit ? ' LIMIT ? OFFSET ?' : ''}`
        : `SELECT * FROM question_sets WHERE (project_id IS NULL OR project_id = ?) ORDER BY name ASC${hasLimit ? ' LIMIT ? OFFSET ?' : ''}`;
    const stmt = this.db.prepare(sql);
    if (projectId === null) {
      return (hasLimit ? stmt.all(limit, offset ?? 0) : stmt.all()) as QuestionSet[];
    }
    return (hasLimit ? stmt.all(projectId, limit, offset ?? 0) : stmt.all(projectId)) as QuestionSet[];
  }

  private buildUpdateFields(data: { name?: string; description?: string; questions?: string }) {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    if (data.questions !== undefined) {
      fields.push('questions = ?');
      values.push(data.questions);
    }
    return { fields, values };
  }

  updateQuestionSet(id: number, data: { name?: string; description?: string; questions?: string }): void {
    const { fields, values } = this.buildUpdateFields(data);
    if (fields.length === 0) return;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`UPDATE question_sets SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  deleteQuestionSet(id: number): void {
    const stmt = this.db.prepare('DELETE FROM question_sets WHERE id = ?');
    stmt.run(id);
  }

  duplicateQuestionSet(id: number, projectId: number | null): number {
    const existing = this.getQuestionSet(id);
    if (!existing) throw new Error('QuestionSet not found');

    const stmt = this.db.prepare(`
      INSERT INTO question_sets (project_id, name, description, questions)
      VALUES (?, ?, ?, ?)
    `);
    const newName = existing.name.endsWith('(Cópia)') ? existing.name : `${existing.name} (Cópia)`;
    const info = stmt.run(projectId, newName, existing.description, existing.questions);

    return info.lastInsertRowid as number;
  }
}

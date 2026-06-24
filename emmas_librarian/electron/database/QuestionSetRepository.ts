import Database from 'better-sqlite3';
import { QuestionSet } from '../types';

export class QuestionSetRepository {
  constructor(private db: Database.Database) {}

  createQuestionSet(data: { project_id: number | null; name: string; description?: string; questions: string }): QuestionSet {
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

  listQuestionSets(projectId: number | null): QuestionSet[] {
    if (projectId === null) {
      const stmt = this.db.prepare(`SELECT * FROM question_sets WHERE project_id IS NULL ORDER BY name ASC`);
      return stmt.all() as QuestionSet[];
    }
    const stmt = this.db.prepare(`
      SELECT * FROM question_sets 
      WHERE project_id IS NULL OR project_id = ?
      ORDER BY name ASC
    `);
    return stmt.all(projectId) as QuestionSet[];
  }

  updateQuestionSet(id: number, data: { name?: string; description?: string; questions?: string }): void {
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

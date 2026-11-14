import type { Database } from 'better-sqlite3';

export class MassiveInvestigationRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  public saveMassiveInvestigation(
    projectId: number,
    questions: string[],
    articlesIds: number[],
    modelUsed: string,
    status: string,
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO massive_investigations (project_id, questions, articles_ids, model_used, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(projectId, JSON.stringify(questions), JSON.stringify(articlesIds), modelUsed, status);
    return info.lastInsertRowid as number;
  }

  public getMassiveInvestigations(projectId: number): unknown[] {
    const stmt = this.db.prepare('SELECT * FROM massive_investigations WHERE project_id = ? ORDER BY created_at DESC');
    return stmt.all(projectId);
  }
}

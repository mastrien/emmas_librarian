import Database from 'better-sqlite3';
import type { AIModelConfig, AISkill, AIProvider } from '../types';

export class AIModelConfigRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  getAllConfigs(): AIModelConfig[] {
    const stmt = this.db.prepare(`
      SELECT id, skill, provider, model_name, updated_at
      FROM ai_model_config
    `);
    return stmt.all() as AIModelConfig[];
  }

  getConfig(skill: AISkill): AIModelConfig | undefined {
    const stmt = this.db.prepare(`
      SELECT id, skill, provider, model_name, updated_at
      FROM ai_model_config
      WHERE skill = ?
    `);
    return stmt.get(skill) as AIModelConfig | undefined;
  }

  updateConfig(skill: AISkill, provider: AIProvider, modelName: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO ai_model_config (skill, provider, model_name)
      VALUES (@skill, @provider, @modelName)
      ON CONFLICT(skill) DO UPDATE SET
        provider = excluded.provider,
        model_name = excluded.model_name,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run({ skill, provider, modelName });
  }

  restoreDefaults(): void {
    const defaults = [
      { skill: 'metadata', provider: 'gemini', model_name: 'gemini-2.5-flash' },
      { skill: 'summary', provider: 'gemini', model_name: 'gemini-2.5-flash' },
      { skill: 'extraction', provider: 'gemini', model_name: 'gemini-2.5-flash' },
      { skill: 'embeddings', provider: 'ollama', model_name: 'nomic-embed-text' },
    ];

    const stmt = this.db.prepare(`
      INSERT INTO ai_model_config (skill, provider, model_name)
      VALUES (@skill, @provider, @model_name)
      ON CONFLICT(skill) DO UPDATE SET
        provider = excluded.provider,
        model_name = excluded.model_name,
        updated_at = CURRENT_TIMESTAMP
    `);

    const transaction = this.db.transaction(() => {
      for (const def of defaults) {
        stmt.run(def);
      }
    });

    transaction();
  }
}

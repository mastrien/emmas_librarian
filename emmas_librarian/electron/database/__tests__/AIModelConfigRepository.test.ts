import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { AIModelConfigRepository } from '../AIModelConfigRepository';

describe('AIModelConfigRepository', () => {
  let db: Database.Database;
  let repo: AIModelConfigRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
    db.exec(schema);
    
    repo = new AIModelConfigRepository(db);
  });

  afterEach(() => {
    if (db) db.close();
  });

  it('should return default configs when getting all', () => {
    const configs = repo.getAllConfigs();
    expect(configs).toHaveLength(4);
    
    const extractionConfig = configs.find(c => c.skill === 'extraction');
    expect(extractionConfig).toBeDefined();
    expect(extractionConfig?.provider).toBe('gemini');
    expect(extractionConfig?.model_name).toBe('gemini-2.5-flash');
  });

  it('should update a specific config', () => {
    repo.updateConfig('extraction', 'openai', 'gpt-4o');
    
    const configs = repo.getAllConfigs();
    const extractionConfig = configs.find(c => c.skill === 'extraction');
    expect(extractionConfig?.provider).toBe('openai');
    expect(extractionConfig?.model_name).toBe('gpt-4o');
  });

  it('should insert a config if it does not exist when updating', () => {
    // Delete all configs manually first
    db.exec('DELETE FROM ai_model_config');
    
    repo.updateConfig('summary', 'anthropic', 'claude-3-haiku');
    
    const configs = repo.getAllConfigs();
    expect(configs).toHaveLength(1);
    expect(configs[0].skill).toBe('summary');
    expect(configs[0].provider).toBe('anthropic');
  });

  it('should restore default configs', () => {
    repo.updateConfig('extraction', 'openai', 'gpt-4o');
    repo.updateConfig('metadata', 'openai', 'gpt-4o-mini');
    
    repo.restoreDefaults();
    
    const configs = repo.getAllConfigs();
    const extractionConfig = configs.find(c => c.skill === 'extraction');
    expect(extractionConfig?.provider).toBe('gemini');
    expect(extractionConfig?.model_name).toBe('gemini-2.5-flash');
  });
});

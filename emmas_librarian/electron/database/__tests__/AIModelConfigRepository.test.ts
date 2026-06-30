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

    const extractionConfig = configs.find((c) => c.skill === 'extraction');
    expect(extractionConfig).toBeDefined();
    expect(extractionConfig?.provider).toBe('gemini');
    expect(extractionConfig?.model_name).toBe('gemini-2.5-flash');

    const metadataConfig = configs.find((c) => c.skill === 'metadata');
    expect(metadataConfig).toBeDefined();
    expect(metadataConfig?.provider).toBe('gemini');
    expect(metadataConfig?.model_name).toBe('gemini-2.5-flash');

    const summaryConfig = configs.find((c) => c.skill === 'summary');
    expect(summaryConfig).toBeDefined();
    expect(summaryConfig?.provider).toBe('gemini');
    expect(summaryConfig?.model_name).toBe('gemini-2.5-flash');

    const embeddingsConfig = configs.find((c) => c.skill === 'embeddings');
    expect(embeddingsConfig).toBeDefined();
    expect(embeddingsConfig?.provider).toBe('ollama');
    expect(embeddingsConfig?.model_name).toBe('nomic-embed-text');
  });

  it('should retrieve a specific config using getConfig', () => {
    const config = repo.getConfig('extraction');
    expect(config).toBeDefined();
    expect(config?.skill).toBe('extraction');
    expect(config?.provider).toBe('gemini');
    expect(config?.model_name).toBe('gemini-2.5-flash');
  });

  it('should return undefined for a non-existent skill using getConfig', () => {
    const config = repo.getConfig('non-existent' as any);
    expect(config).toBeUndefined();
  });

  it('should update a specific config', () => {
    repo.updateConfig('extraction', 'openai', 'gpt-4o');

    const configs = repo.getAllConfigs();
    const extractionConfig = configs.find((c) => c.skill === 'extraction');
    expect(extractionConfig?.provider).toBe('openai');
    expect(extractionConfig?.model_name).toBe('gpt-4o');
    expect(extractionConfig?.updated_at).toBeDefined();
  });

  it('should insert a config if it does not exist when updating', () => {
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
    repo.updateConfig('summary', 'openai', 'gpt-4');
    repo.updateConfig('embeddings', 'openai', 'text-embedding-3-small');

    repo.restoreDefaults();

    const configs = repo.getAllConfigs();
    expect(configs).toHaveLength(4);

    const extractionConfig = configs.find((c) => c.skill === 'extraction');
    expect(extractionConfig?.provider).toBe('gemini');
    expect(extractionConfig?.model_name).toBe('gemini-2.5-flash');

    const metadataConfig = configs.find((c) => c.skill === 'metadata');
    expect(metadataConfig?.provider).toBe('gemini');
    expect(metadataConfig?.model_name).toBe('gemini-2.5-flash');

    const summaryConfig = configs.find((c) => c.skill === 'summary');
    expect(summaryConfig?.provider).toBe('gemini');
    expect(summaryConfig?.model_name).toBe('gemini-2.5-flash');

    const embeddingsConfig = configs.find((c) => c.skill === 'embeddings');
    expect(embeddingsConfig?.provider).toBe('ollama');
    expect(embeddingsConfig?.model_name).toBe('nomic-embed-text');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIService } from '../AIService';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { AIModelConfigRepository } from '../../database/AIModelConfigRepository';

describe('AIService.askModels (#53)', () => {
  let db: DatabaseAdapter;
  let ai: AIService;

  beforeEach(() => {
    db = new DatabaseAdapter(':memory:');
    ai = new AIService(db);
  });

  it('names the embedding model configured now', () => {
    const config = new AIModelConfigRepository(db.getDB());
    config.updateConfig('embeddings', 'ollama', 'nomic');
    expect(ai.askModels().modelId).toBe('ollama/nomic');

    config.updateConfig('embeddings', 'openai', 'small');
    expect(ai.askModels().modelId).toBe('openai/small');
  });

  it('answers through the extraction model', async () => {
    const completion = vi.fn(async () => 'resposta');
    (ai as unknown as { generateCompletion: typeof completion }).generateCompletion = completion;

    expect(await ai.askModels().complete('pergunta')).toBe('resposta');
    expect(completion).toHaveBeenCalledWith('pergunta', 'extraction');
  });
});

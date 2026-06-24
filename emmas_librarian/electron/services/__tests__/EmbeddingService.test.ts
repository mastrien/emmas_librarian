import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingService } from '../EmbeddingService';
import { AIModelConfig } from '../../../src/types';

const mockConfig: AIModelConfig = {
  id: 1,
  skill: 'embeddings',
  provider: 'ollama',
  model_name: 'nomic-embed-text',
  updated_at: '2026-06-23T00:00:00Z',
};

describe('EmbeddingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate embedding for a single text', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
    });

    const service = new EmbeddingService(mockConfig, { ollama: 'http://localhost:11434' });
    const result = await service.embed('hello world');

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:11434/api/embeddings', expect.any(Object));
    // @ts-ignore
    const reqBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(reqBody.model).toBe('nomic-embed-text');
    expect(reqBody.prompt).toBe('hello world');
  });

  it('should generate embeddings in batch', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.1] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.2] }),
      });

    const service = new EmbeddingService(mockConfig);
    const result = await service.embedBatch(['text1', 'text2']);

    expect(result).toEqual([[0.1], [0.2]]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

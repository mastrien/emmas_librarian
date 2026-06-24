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
    global.fetch = vi
      .fn()
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

  it('should support ollama v1 endpoints', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [0.9] }),
    });
    const config = { ...mockConfig, provider: 'ollama' as const };
    const service = new EmbeddingService(config, { ollama: 'http://localhost:11434/v1/' });
    const result = await service.embed('test v1');
    expect(result).toEqual([0.9]);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:11434/v1/embeddings', expect.any(Object));
  });

  it('should handle ollama error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Internal Error',
    });
    const service = new EmbeddingService(mockConfig);
    await expect(service.embed('fail')).rejects.toThrow('Ollama embedding error');
  });

  it('should generate embedding using OpenAI', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.5, 0.6] }] }),
    });
    const config = { ...mockConfig, provider: 'openai' as const, model_name: 'text-embedding-3-small' };
    const service = new EmbeddingService(config, { openai: 'sk-test' });
    const result = await service.embed('hello openai');
    expect(result).toEqual([0.5, 0.6]);
  });

  it('should throw if OpenAI key is missing', async () => {
    const config = { ...mockConfig, provider: 'openai' as const };
    const service = new EmbeddingService(config, {});
    await expect(service.embed('test')).rejects.toThrow('OpenAI API key missing');
  });

  it('should handle OpenAI API errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
      text: async () => 'Invalid Key',
    });
    const config = { ...mockConfig, provider: 'openai' as const };
    const service = new EmbeddingService(config, { openai: 'sk-invalid' });
    await expect(service.embed('test')).rejects.toThrow('OpenAI embedding error');
  });

  it('should generate embedding using Gemini', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: { values: [0.7, 0.8] } }),
    });
    const config = { ...mockConfig, provider: 'gemini' as const, model_name: 'text-embedding-004' };
    const service = new EmbeddingService(config, { gemini: 'gemini-key' });
    const result = await service.embed('hello gemini');
    expect(result).toEqual([0.7, 0.8]);
  });

  it('should throw if Gemini key is missing', async () => {
    const config = { ...mockConfig, provider: 'gemini' as const };
    const service = new EmbeddingService(config, {});
    await expect(service.embed('test')).rejects.toThrow('Gemini API key missing');
  });

  it('should handle Gemini API errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      text: async () => 'Error payload',
    });
    const config = { ...mockConfig, provider: 'gemini' as const };
    const service = new EmbeddingService(config, { gemini: 'gemini-key' });
    await expect(service.embed('test')).rejects.toThrow('Gemini embedding error');
  });

  it('should throw for Anthropic provider', async () => {
    const config = { ...mockConfig, provider: 'anthropic' as const };
    const service = new EmbeddingService(config, {});
    await expect(service.embed('test')).rejects.toThrow('Anthropic currently does not provide');
  });

  it('should throw for unknown provider', async () => {
    const config = { ...mockConfig, provider: 'unknown' as any };
    const service = new EmbeddingService(config, {});
    await expect(service.embed('test')).rejects.toThrow('Embedding for provider unknown not implemented');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaCloudGateway } from '../OllamaCloudGateway';

describe('OllamaCloudGateway', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should complete successfully with Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Ollama Cloud Response' } }],
      }),
    });
    global.fetch = fetchMock;

    const gateway = new OllamaCloudGateway('https://api.ollama.cloud/v1/', 'secret-cloud-key');
    const response = await gateway.complete('qual o resumo do artigo?', 'llama3.1:70b');

    expect(response).toBe('Ollama Cloud Response');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.ollama.cloud/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret-cloud-key',
        },
        body: JSON.stringify({
          model: 'llama3.1:70b',
          messages: [{ role: 'user', content: 'qual o resumo do artigo?' }],
          temperature: 0.2,
        }),
      }),
    );
  });

  it('should fallback to default URL https://ollama.com/v1 if baseUrl is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Default Response' } }],
      }),
    });
    global.fetch = fetchMock;

    const gateway = new OllamaCloudGateway('', 'secret-cloud-key');
    const response = await gateway.complete('hello', 'llama3');
    expect(response).toBe('Default Response');
    expect(fetchMock).toHaveBeenCalledWith('https://ollama.com/v1/chat/completions', expect.any(Object));
  });

  it('should throw Error if apiKey is missing', async () => {
    const gateway = new OllamaCloudGateway('https://api.ollama.cloud/v1', '');
    await expect(gateway.complete('hello', 'llama3')).rejects.toThrow('Chave de API do Ollama Cloud não configurada');
  });

  it('should throw QUOTA_EXCEEDED on 429 status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });
    const gateway = new OllamaCloudGateway('https://api.ollama.cloud/v1', 'secret-cloud-key');
    await expect(gateway.complete('hello', 'llama3')).rejects.toThrow('QUOTA_EXCEEDED');
  });

  it('should use default https://ollama.com/v1 if baseUrl is empty or not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Default URL Response' } }],
      }),
    });
    global.fetch = fetchMock;

    const gateway = new OllamaCloudGateway('', 'secret-cloud-key');
    const response = await gateway.complete('hello', 'gpt-oss:120b');

    expect(response).toBe('Default URL Response');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ollama.com/v1/chat/completions',
      expect.any(Object),
    );
  });

  it('should sanitize HTML 503 error responses into clean AppError messages', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => '<html><body><h1>503 Service Unavailable</h1>No server is available</body></html>',
    });
    const gateway = new OllamaCloudGateway('https://ollama.com/v1', 'secret-cloud-key');
    await expect(gateway.complete('hello', 'llama3')).rejects.toThrow(
      '503 Service Unavailable No server is available',
    );
  });
});

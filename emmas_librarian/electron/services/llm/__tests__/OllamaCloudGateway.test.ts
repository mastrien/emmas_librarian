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

  it('should throw Error if baseUrl is missing', async () => {
    const gateway = new OllamaCloudGateway('', 'secret-cloud-key');
    await expect(gateway.complete('hello', 'llama3')).rejects.toThrow('URL do Ollama Cloud não configurada');
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

  it('should handle general HTTP error responses with status and details', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized access token',
    });
    const gateway = new OllamaCloudGateway('https://api.ollama.cloud/v1', 'secret-cloud-key');
    await expect(gateway.complete('hello', 'llama3')).rejects.toThrow(
      'Ollama Cloud API Error (HTTP 401): Unauthorized access token',
    );
  });
});

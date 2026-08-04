import type { LLMProviderGateway } from './LLMProviderGateway';
import { AppError } from '../../ipc/errorHandler';

/**
 * Handles communication with hosted/cloud Ollama instances.
 * Requires API key authentication and supports custom cloud endpoints.
 *
 * @example
 * const gateway = new OllamaCloudGateway('https://api.ollama.cloud/v1', 'my-api-key');
 * const response = await gateway.complete('Summarize paper', 'llama3.1:70b');
 */
export class OllamaCloudGateway implements LLMProviderGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async complete(prompt: string, model: string): Promise<string> {
    if (!this.apiKey) {
      throw new AppError('ERR_MISSING_API_KEY', 'USER_ERROR', 'Chave de API do Ollama Cloud não configurada.');
    }

    const endpoint = this.buildEndpointUrl();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-oss:120b-cloud',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new AppError('ERR_API_QUOTA_EXCEEDED', 'SYSTEM_ERROR', 'QUOTA_EXCEEDED');
      }
      const rawText = await response.text();
      const cleanText = this.sanitizeHtml(rawText);
      if (response.status === 401 || response.status === 403) {
        throw new AppError(
          'ERR_API_UNAUTHORIZED',
          'USER_ERROR',
          `[ERR_API_UNAUTHORIZED] Credenciais do Ollama Cloud inválidas (HTTP ${response.status}): ${cleanText}`,
        );
      }
      throw new AppError(
        'ERR_API_CONNECTION',
        'SYSTEM_ERROR',
        `[ERR_API_CONNECTION] Erro no serviço Ollama Cloud (HTTP ${response.status}): ${cleanText}`,
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? data.content;
    if (!content) {
      throw new AppError(
        'ERR_INVALID_AI_RESPONSE',
        'SYSTEM_ERROR',
        `[ERR_INVALID_AI_RESPONSE] A resposta da API do Ollama Cloud não contém mensagem válida. Offending value: "${JSON.stringify(
          data,
        ).slice(0, 100)}...". Expected shape: Objeto com choices[0].message.content.`,
      );
    }

    return content;
  }

  private buildEndpointUrl(): string {
    let url = (this.baseUrl || 'https://ollama.com/v1').trim();
    if (url.endsWith('/')) url = url.slice(0, -1);
    return url.endsWith('/chat/completions') ? url : `${url}/chat/completions`;
  }

  private sanitizeHtml(text: string): string {
    if (!text) return 'Nenhum detalhe retornado pelo servidor.';
    const clean = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    return clean || 'Serviço indisponível no provedor remoto.';
  }
}

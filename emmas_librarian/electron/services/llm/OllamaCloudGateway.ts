import type { LLMProviderGateway } from './LLMProviderGateway';

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
    if (!this.baseUrl) {
      throw new Error('URL do Ollama Cloud não configurada.');
    }
    if (!this.apiKey) {
      throw new Error('Chave de API do Ollama Cloud não configurada.');
    }

    const endpoint = this.buildEndpointUrl();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'llama3.1:70b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('QUOTA_EXCEEDED');
      }
      const errText = await response.text();
      throw new Error(
        `Ollama Cloud API Error (HTTP ${response.status}): ${errText || 'No error details provided by provider'}`,
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? data.content;
    if (!content) {
      throw new Error(
        `[ERR_INVALID_AI_RESPONSE] A resposta da API do Ollama Cloud não contém mensagem válida. Offending value: "${JSON.stringify(
          data,
        ).slice(0, 100)}...". Expected shape: Objeto com choices[0].message.content.`,
      );
    }

    return content;
  }

  private buildEndpointUrl(): string {
    let url = this.baseUrl.trim();
    if (url.endsWith('/')) url = url.slice(0, -1);
    return url.endsWith('/chat/completions') ? url : `${url}/chat/completions`;
  }
}

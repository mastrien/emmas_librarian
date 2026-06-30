import type { LLMProviderGateway } from './LLMProviderGateway';

export class OllamaGateway implements LLMProviderGateway {
  constructor(private readonly baseUrl: string) {}

  async complete(prompt: string, model: string): Promise<string> {
    if (!this.baseUrl) throw new Error('URL do Ollama não configurada.');

    let url = this.baseUrl.trim();
    if (url.endsWith('/')) url = url.slice(0, -1);

    const response = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama/Local API Error: ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

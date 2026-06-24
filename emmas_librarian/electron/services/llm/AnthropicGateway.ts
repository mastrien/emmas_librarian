import type { LLMProviderGateway } from './LLMProviderGateway';

export class AnthropicGateway implements LLMProviderGateway {
  constructor(private readonly apiKey: string) {}

  async complete(prompt: string, model: string): Promise<string> {
    if (!this.apiKey) throw new Error('Chave de API da Anthropic não configurada.');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API Error: ${err}`);
    }
    
    const data = await response.json();
    return data.content[0].text;
  }
}

import type { LLMProviderGateway } from './LLMProviderGateway';

export class OpenAIGateway implements LLMProviderGateway {
  constructor(private readonly apiKey: string) {}

  async complete(prompt: string, model: string): Promise<string> {
    if (!this.apiKey) throw new Error('Chave de API da OpenAI não configurada.');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('QUOTA_EXCEEDED');
      }
      const err = await response.text();
      throw new Error(`OpenAI API Error: ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

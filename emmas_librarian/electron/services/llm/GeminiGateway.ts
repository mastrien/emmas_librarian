import type { LLMProviderGateway } from './LLMProviderGateway';

export class GeminiGateway implements LLMProviderGateway {
  constructor(private readonly apiKey: string) {}

  async complete(prompt: string, model: string): Promise<string> {
    if (!this.apiKey) throw new Error('Chave de API do Gemini não configurada.');
    const actualModel = model || 'gemini-2.5-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('QUOTA_EXCEEDED');
      }
      const err = await response.text();
      throw new Error(`Gemini API Error: ${err}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
}

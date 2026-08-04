import { AIModelConfig } from '../../src/types';

export class EmbeddingService {
  constructor(
    private readonly config: AIModelConfig,
    private readonly keys?: any,
  ) {}

  async embed(text: string): Promise<number[]> {
    if (this.config.provider === 'ollama') {
      let url = (this.keys?.ollama || 'http://localhost:11434').trim();
      if (url.endsWith('/')) url = url.slice(0, -1);

      let endpoint = `${url}/api/embeddings`;
      let body: any = {
        model: this.config.model_name || 'nomic-embed-text',
        prompt: text,
      };

      if (url.includes('/v1')) {
        endpoint = `${url}/embeddings`;
        body = {
          model: this.config.model_name || 'nomic-embed-text',
          input: text,
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Ollama embedding error: ${response.statusText}`);
      }

      const data = await response.json();
      return (data.embedding || data.data?.[0]?.embedding) as number[];
    }

    if (this.config.provider === 'openai') {
      if (!this.keys?.openai) throw new Error('OpenAI API key missing for embeddings');
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.keys.openai}`,
        },
        body: JSON.stringify({
          model: this.config.model_name || 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI embedding error: ${response.statusText} - ${errText}`);
      }

      const data = await response.json();
      return data.data[0].embedding as number[];
    }

    if (this.config.provider === 'gemini') {
      if (!this.keys?.gemini) throw new Error('Gemini API key missing for embeddings');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model_name || 'text-embedding-004'}:embedContent?key=${this.keys.gemini}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${this.config.model_name || 'text-embedding-004'}`,
            content: { parts: [{ text: text }] },
          }),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini embedding error: ${response.statusText} - ${errText}`);
      }

      const data = await response.json();
      return data.embedding.values as number[];
    }

    if (this.config.provider === 'anthropic') {
      throw new Error(`Anthropic currently does not provide a native embedding API endpoint.`);
    }

    throw new Error(`Embedding for provider ${this.config.provider} not implemented yet.`);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    if (this.config.provider === 'openai') {
      if (!this.keys?.openai) throw new Error('OpenAI API key missing for embeddings');
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.keys.openai}`,
        },
        body: JSON.stringify({
          model: this.config.model_name || 'text-embedding-3-small',
          input: texts,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI embedding error: ${response.statusText} - ${errText}`);
      }

      const data = await response.json();
      return data.data.map((item: any) => item.embedding as number[]);
    }

    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
}

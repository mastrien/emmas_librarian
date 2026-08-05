import { AIModelConfig } from '../../src/types';
import { AppError } from '../ipc/errorHandler';

export class EmbeddingService {
  constructor(
    private readonly config: AIModelConfig,
    private readonly keys?: any,
  ) {}

  private async fetchWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelayMs = 2000): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        const isQuotaErr =
          err?.code === 'ERR_API_QUOTA_EXCEEDED' ||
          (err?.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED')));

        if (isQuotaErr && attempt < maxRetries - 1) {
          const delay = initialDelayMs * Math.pow(2, attempt);
          console.warn(
            `[EmbeddingService] Quota 429/Resource Exhausted detectada. Aguardando ${delay}ms para tentativa ${attempt + 2}/${maxRetries}...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

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
        throw new AppError(
          'ERR_API_CONNECTION',
          'SYSTEM_ERROR',
          `Erro no serviço Ollama local (HTTP ${response.status}): ${response.statusText}`,
        );
      }

      const data = await response.json();
      return (data.embedding || data.data?.[0]?.embedding) as number[];
    }

    if (this.config.provider === 'ollama_cloud') {
      if (!this.keys?.ollamaCloud) {
        throw new AppError('ERR_MISSING_API_KEY', 'USER_ERROR', 'Chave de API do Ollama Cloud não configurada para embeddings.');
      }
      let url = (this.keys?.ollamaCloudUrl || 'https://ollama.com/v1').trim();
      if (url.endsWith('/')) url = url.slice(0, -1);

      let endpoint = url.endsWith('/embeddings') ? url : `${url}/embeddings`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.keys.ollamaCloud}`,
        },
        body: JSON.stringify({
          model: this.config.model_name || 'nomic-embed-text',
          input: text,
        }),
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 503) {
          throw new AppError(
            'ERR_MODEL_NOT_DEFINED',
            'USER_ERROR',
            `[ERR_MODEL_NOT_DEFINED] O provedor Ollama Cloud (https://ollama.com/v1) é destinado a geração de texto e metadados (LLMs). Para a funcionalidade de Embeddings (Vetorização), selecione "Ollama (Local)", "OpenAI" ou "Gemini" nas Configurações Avançadas.`,
          );
        }
        const rawText = await response.text();
        const cleanText = rawText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim() || 'Serviço indisponível no provedor remoto.';
        throw new AppError(
          'ERR_API_CONNECTION',
          'SYSTEM_ERROR',
          `[ERR_API_CONNECTION] Erro ao obter embeddings no Ollama Cloud (HTTP ${response.status}): ${cleanText}`,
        );
      }

      const data = await response.json();
      const embedding = data.embedding || data.data?.[0]?.embedding;
      if (!embedding) {
        throw new AppError(
          'ERR_INVALID_AI_RESPONSE',
          'SYSTEM_ERROR',
          `[ERR_INVALID_AI_RESPONSE] A API do Ollama Cloud não retornou um vetor de embedding válido.`,
        );
      }
      return embedding as number[];
    }

    if (this.config.provider === 'openai') {
      if (!this.keys?.openai) throw new AppError('ERR_MISSING_API_KEY', 'USER_ERROR', 'Chave de API da OpenAI não configurada para embeddings.');

      return await this.fetchWithRetry(async () => {
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
          if (response.status === 429) {
            throw new AppError('ERR_API_QUOTA_EXCEEDED', 'USER_ERROR', `[ERR_API_QUOTA_EXCEEDED] Limite de cota/requisições da OpenAI excedido.`);
          }
          throw new AppError('ERR_API_CONNECTION', 'SYSTEM_ERROR', `OpenAI embedding error: ${response.statusText} - ${errText}`);
        }

        const data = await response.json();
        return data.data[0].embedding as number[];
      });
    }

    if (this.config.provider === 'gemini') {
      if (!this.keys?.gemini) throw new AppError('ERR_MISSING_API_KEY', 'USER_ERROR', 'Chave de API do Gemini não configurada para embeddings.');

      let rawModel = (this.config.model_name || 'text-embedding-004').trim();
      if (rawModel.startsWith('models/')) rawModel = rawModel.replace('models/', '');
      const fullModel = `models/${rawModel}`;

      return await this.fetchWithRetry(async () => {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${fullModel}:embedContent?key=${this.keys.gemini}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: fullModel,
              content: { parts: [{ text: text }] },
            }),
          },
        );

        if (!response.ok) {
          const errText = await response.text();
          if (response.status === 429) {
            throw new AppError(
              'ERR_API_QUOTA_EXCEEDED',
              'USER_ERROR',
              `[ERR_API_QUOTA_EXCEEDED] Cota limite de requisições por minuto (100 RPM) da API gratuita do Gemini excedida. Aguarde alguns segundos e tente novamente.`,
            );
          }
          const cleanText = errText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
          throw new AppError(
            'ERR_API_CONNECTION',
            'SYSTEM_ERROR',
            `[ERR_API_CONNECTION] Erro no Gemini embedding (HTTP ${response.status}): ${cleanText}`,
          );
        }

        const data = await response.json();
        if (!data.embedding?.values) {
          throw new AppError('ERR_INVALID_AI_RESPONSE', 'SYSTEM_ERROR', `A API do Gemini não retornou um vetor de embedding válido.`);
        }
        return data.embedding.values as number[];
      });
    }

    if (this.config.provider === 'anthropic') {
      throw new AppError('ERR_MODEL_NOT_DEFINED', 'USER_ERROR', `O provedor Anthropic não possui API nativa de embeddings.`);
    }

    throw new AppError('ERR_MODEL_NOT_DEFINED', 'USER_ERROR', `Provedor de embedding ${this.config.provider} não suportado.`);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    if (this.config.provider === 'openai') {
      if (!this.keys?.openai) throw new AppError('ERR_MISSING_API_KEY', 'USER_ERROR', 'Chave de API da OpenAI não configurada para embeddings.');

      return await this.fetchWithRetry(async () => {
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
          if (response.status === 429) {
            throw new AppError('ERR_API_QUOTA_EXCEEDED', 'USER_ERROR', `[ERR_API_QUOTA_EXCEEDED] Limite de cota/requisições da OpenAI excedido.`);
          }
          throw new AppError('ERR_API_CONNECTION', 'SYSTEM_ERROR', `OpenAI embedding error: ${response.statusText} - ${errText}`);
        }

        const data = await response.json();
        return data.data.map((item: any) => item.embedding as number[]);
      });
    }

    if (this.config.provider === 'gemini') {
      if (!this.keys?.gemini) throw new AppError('ERR_MISSING_API_KEY', 'USER_ERROR', 'Chave de API do Gemini não configurada para embeddings.');

      let rawModel = (this.config.model_name || 'text-embedding-004').trim();
      if (rawModel.startsWith('models/')) rawModel = rawModel.replace('models/', '');
      const fullModel = `models/${rawModel}`;

      const BATCH_SIZE = 50;
      const allEmbeddings: number[][] = [];

      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batchTexts = texts.slice(i, i + BATCH_SIZE);
        const requestsPayload = batchTexts.map((txt) => ({
          model: fullModel,
          content: { parts: [{ text: txt }] },
        }));

        const batchEmbeddings = await this.fetchWithRetry(async () => {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${fullModel}:batchEmbedContents?key=${this.keys.gemini}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ requests: requestsPayload }),
            },
          );

          if (!response.ok) {
            const errText = await response.text();
            if (response.status === 429) {
              throw new AppError(
                'ERR_API_QUOTA_EXCEEDED',
                'USER_ERROR',
                `[ERR_API_QUOTA_EXCEEDED] Cota limite de requisições por minuto da API gratuita do Gemini excedida. Aguarde alguns segundos e tente novamente.`,
              );
            }
            const cleanText = errText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
            throw new AppError(
              'ERR_API_CONNECTION',
              'SYSTEM_ERROR',
              `[ERR_API_CONNECTION] Erro no Gemini batch embedding (HTTP ${response.status}): ${cleanText}`,
            );
          }

          const data = await response.json();
          if (!data.embeddings || !Array.isArray(data.embeddings)) {
            throw new AppError('ERR_INVALID_AI_RESPONSE', 'SYSTEM_ERROR', `A API do Gemini não retornou vetores em lote válidos.`);
          }
          return data.embeddings.map((item: any) => item.values as number[]);
        });

        allEmbeddings.push(...batchEmbeddings);

        if (i + BATCH_SIZE < texts.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      return allEmbeddings;
    }

    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
}

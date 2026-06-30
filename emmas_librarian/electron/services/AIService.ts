import fs from 'fs';
import { DatabaseAdapter } from '../database/DatabaseAdapter';
import { AIModelConfigRepository } from '../database/AIModelConfigRepository';
import { EmbeddingService } from './EmbeddingService';
import { VectorStore } from './VectorStore';
import { extractTextWithCoordinates } from './PdfExtractor';
import { AppError } from '../ipc/errorHandler';
export class AIService {
  private db: DatabaseAdapter;

  constructor(db: DatabaseAdapter) {
    this.db = db;
  }

  // --- Utility: Extract Text from PDF ---
  public async extractTextFromPdf(pdfPath: string): Promise<string> {
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    try {
      const { chunks } = await extractTextWithCoordinates(pdfPath, 1000, 200);
      return chunks.map((c) => c.text).join('\n\n');
    } catch (err) {
      console.error('Error parsing PDF:', err);
      throw new AppError('ERR_INVALID_PDF', 'VALIDATION_ERROR', 'Falha ao ler o arquivo PDF');
    }
  }

  // --- API Clients ---

  public getKeys() {
    return {
      openai: this.db.getSetting('api_key_openai'),
      gemini: this.db.getSetting('api_key_gemini'),
      anthropic: this.db.getSetting('api_key_anthropic'),
      ollama: this.db.getSetting('api_key_ollama'),
      ollamaModel: this.db.getSetting('ollama_model'),
    };
  }

  private async callOpenAI(prompt: string, apiKey: string, model: string = 'gpt-4o-mini'): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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

  private async callGemini(prompt: string, apiKey: string, model: string = 'gemini-2.5-flash'): Promise<string> {
    const modelName = model || 'gemini-2.5-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
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

  private async callOllama(prompt: string, baseUrl: string, model: string): Promise<string> {
    // Clean URL
    let url = baseUrl.trim();
    if (url.endsWith('/')) url = url.slice(0, -1);

    // Expecting OpenAI compatible endpoint like http://localhost:11434/v1
    const response = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model, // uses the configured model or fallback
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

  private async generateCompletion(
    prompt: string,
    skill: 'metadata' | 'summary' | 'extraction' = 'metadata',
  ): Promise<string> {
    const keys = this.getKeys();
    const configRepo = new AIModelConfigRepository(this.db.getDB());
    let config = configRepo.getConfig(skill as any);

    try {
      if (config) {
        // Use the configured provider
        if (config.provider === 'openai') {
          if (!keys.openai)
            throw new AppError('ERR_MODEL_NOT_DEFINED', 'USER_ERROR', 'Chave da OpenAI não configurada.');
          return await this.callOpenAI(prompt, keys.openai, config.model_name);
        } else if (config.provider === 'gemini') {
          if (!keys.gemini)
            throw new AppError('ERR_MODEL_NOT_DEFINED', 'USER_ERROR', 'Chave do Gemini não configurada.');
          return await this.callGemini(prompt, keys.gemini, config.model_name);
        } else if (config.provider === 'ollama') {
          if (!keys.ollama) throw new AppError('ERR_MODEL_NOT_DEFINED', 'USER_ERROR', 'URL do Ollama não configurada.');
          return await this.callOllama(prompt, keys.ollama, config.model_name || keys.ollamaModel || 'llama3');
        } else {
          throw new AppError('ERR_MODEL_NOT_DEFINED', 'USER_ERROR', 'Provedor configurado é inválido.');
        }
      }

      // Fallback: Prioritize OpenAI -> Gemini -> Ollama
      if (keys.openai) {
        return await this.callOpenAI(prompt, keys.openai);
      } else if (keys.gemini) {
        return await this.callGemini(prompt, keys.gemini);
      } else if (keys.ollama) {
        return await this.callOllama(prompt, keys.ollama, keys.ollamaModel || 'llama3');
      } else {
        throw new AppError(
          'ERR_MODEL_NOT_DEFINED',
          'USER_ERROR',
          'Nenhuma chave de IA configurada. Por favor, adicione uma chave nas configurações.',
        );
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      if (err.message === 'QUOTA_EXCEEDED') throw err;
      if (err.message && err.message.includes('fetch failed')) {
        throw new AppError(
          'ERR_API_CONNECTION',
          'SYSTEM_ERROR',
          'Falha de conexão com o provedor de Inteligência Artificial. Verifique sua conexão com a internet ou se o serviço local (ex: Ollama) está rodando na porta correta.',
        );
      }
      throw err;
    }
  }

  // --- Features ---

  public async generateSummary(
    articleId: number,
    pdfPath: string,
  ): Promise<{ generalSummary: string; sectionSummary: string }> {
    const article = this.db.getArticle(articleId);
    if (article?.ai_summary) {
      try {
        return JSON.parse(article.ai_summary);
      } catch (e) {
        // Fallback to regenerate if parsing fails
      }
    }

    const text = await this.extractTextFromPdf(pdfPath);
    // Limit text to avoid token limits on smaller models, though 4o-mini and Gemini can handle huge texts.
    // For safety, let's truncate to first ~80000 chars (approx 20k tokens)
    const truncatedText = text.substring(0, 80000);

    const prompt = `Você é um assistente acadêmico. Por favor, leia o texto do artigo científico fornecido abaixo e produza duas coisas:
1. Um resumo geral do artigo (aprox. 1 parágrafo).
2. Um resumo dividido por seções principais do artigo.

A sua resposta deve ser EXATAMENTE um objeto JSON válido, sem markdown, contendo:
{
  "generalSummary": "seu resumo geral aqui",
  "sectionSummary": "seu resumo detalhado por seções aqui, pode conter quebras de linha \\n"
}

ARTIGO:
${truncatedText}
`;

    let result = await this.generateCompletion(prompt, 'summary');
    // clean up potential markdown code blocks
    result = result
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    try {
      const parsed = JSON.parse(result);
      this.db.updateArticleAiSummary(articleId, JSON.stringify(parsed));
      return parsed;
    } catch (err) {
      console.error('Failed to parse LLM JSON:', result);
      throw new Error('A IA não retornou um formato JSON válido.');
    }
  }

  public async massiveExtraction(articleId: number, pdfPath: string, questions: string[]): Promise<any[]> {
    const extractionConfig = {
      chunkSize: parseInt(this.db.getSetting('rag_chunk_size') || '1000', 10),
      chunkOverlap: parseInt(this.db.getSetting('rag_chunk_overlap') || '200', 10),
      topK: parseInt(this.db.getSetting('rag_top_k') || '10', 10),
    };

    const extractionResult = await extractTextWithCoordinates(
      pdfPath,
      extractionConfig.chunkSize,
      extractionConfig.chunkOverlap,
    );
    // Services imported at the top

    const configRepo = new AIModelConfigRepository(this.db.getDB());
    const embeddingsConfig = configRepo.getConfig('embeddings');
    const embeddingService = new EmbeddingService(
      {
        provider: embeddingsConfig?.provider || 'openai',
        model_name: embeddingsConfig?.model_name || 'text-embedding-3-small',
      } as any,
      this.getKeys(),
    );
    const vectorStore = new VectorStore(this.db.getDB());

    if (questions.length === 0) return [];

    const firstQueryEmbedding = await embeddingService.embed(questions[0]);
    vectorStore.ensureDimensionAndClearIfMismatched(firstQueryEmbedding.length);

    const existingChunksCount = this.db
      .getDB()
      .prepare('SELECT count(*) as count FROM pdf_chunks WHERE article_id = ?')
      .get(articleId) as any;
    if (existingChunksCount.count === 0) {
      const embeddings = await embeddingService.embedBatch(extractionResult.chunks.map((c: any) => c.text));
      vectorStore.indexArticleChunks(articleId, extractionResult.chunks, embeddings);
    }

    const results = [];
    for (const question of questions) {
      const queryEmbedding = await embeddingService.embed(question);
      const relevantChunks = vectorStore.searchSimilar(queryEmbedding, extractionConfig.topK, articleId);
      const contextPrompt = relevantChunks
        .map(
          (c: any, i: number) =>
            `[Trecho ${i + 1} - Página ${c.page} - Score: ${(1 / (1 + c.similarityScore)).toFixed(2)}]\n${c.text}`,
        )
        .join('\n\n');

      const prompt = `Você é um assistente acadêmico RAG. Baseado nos trechos do texto fornecidos, responda à pergunta.
A sua resposta deve ser EXATAMENTE um objeto JSON válido (sem tags markdown de código), no seguinte formato:
{
  "question": "${question}",
  "synthesizedAnswer": "Sua resposta completa",
  "confidenceScore": 0.95,
  "evidences": [
    {
      "text": "trecho EXATO e COMPLETO do texto original usado como base (nunca extraia apenas palavras soltas; extraia a frase inteira ou parágrafo completo que contém a informação)",
      "page": 1,
      "score": 0.85,
      "reasoning": "Por que este trecho justifica a resposta"
    }
  ]
}
Se não for possível encontrar a resposta nos trechos, responda com confidenceScore baixo e evidences vazias. Copie o score do trecho correspondente para o campo 'score'.

PERGUNTA:
${question}

TRECHOS:
${contextPrompt}
`;
      let result = await this.generateCompletion(prompt, 'extraction');
      result = result
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      try {
        const parsed = JSON.parse(result);
        if (parsed.evidences && parsed.evidences.length > 0) {
          for (const ev of parsed.evidences) {
            const matchedChunk = relevantChunks.find(
              (c: any) => c.page === ev.page && (c.text.includes(ev.text) || ev.text.includes(c.text)),
            );
            if (matchedChunk && matchedChunk.bbox && matchedChunk.bbox.w > 0) {
              ev.bbox = matchedChunk.bbox;
              if (!ev.score) ev.score = Number((1 / (1 + matchedChunk.similarityScore)).toFixed(2));
            } else {
              ev.bbox = null;
            }
          }
        }
        results.push(parsed);

        if (parsed.evidences) {
          for (const ev of parsed.evidences) {
            if (ev.text) {
              try {
                const formattedAnswer = `Pergunta: ${parsed.question}\n\nResposta: ${parsed.synthesizedAnswer}`;
                this.db.savePendingHighlight(articleId, ev.text, '', '', formattedAnswer);
              } catch (e) {
                console.error('Erro ao salvar pending highlight', e);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to parse LLM JSON for extraction:', result);
        throw new Error('A IA não retornou um formato JSON válido para extração.');
      }
    }
    return results;
  }

  public async extractMetadataFromPdf(articleId: number, pdfPath: string): Promise<any> {
    const text = await this.extractTextFromPdf(pdfPath);
    const truncatedText = text.substring(0, 40000); // 40k chars usually enough for title/authors/abstract

    const prompt = `Você é um assistente acadêmico. Por favor, leia o texto do artigo científico fornecido abaixo e extraia seus metadados.

A sua resposta deve ser EXATAMENTE um objeto JSON válido, sem markdown, contendo as seguintes chaves. Se não encontrar o valor de alguma chave, use null:
{
  "title": "título do artigo",
  "authors": "lista de autores separados por vírgula",
  "year": "ano de publicação apenas com 4 dígitos numéricos, ex: 2024",
  "doi": "DOI do artigo, se presente",
  "journal": "nome da revista ou conferência",
  "abstract": "resumo/abstract original traduzido para o idioma do texto (geralmente inglês ou português)"
}

ARTIGO:
${truncatedText}
`;

    let result = await this.generateCompletion(prompt, 'metadata');
    result = result
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    try {
      const parsed = JSON.parse(result);
      return parsed;
    } catch (err) {
      console.error('Failed to parse LLM JSON for metadata:', result);
      throw new Error('A IA não retornou um formato JSON válido para os metadados.');
    }
  }
}

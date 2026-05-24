import fs from 'fs';
import pdfParseModule from 'pdf-parse';
import { DatabaseManager } from '../database/DatabaseManager';

const pdfParse: any = pdfParseModule;

export class AIService {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  // --- Utility: Extract Text from PDF ---
  public async extractTextFromPdf(pdfPath: string): Promise<string> {
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }
    const dataBuffer = fs.readFileSync(pdfPath);
    try {
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (err) {
      console.error('Error parsing PDF:', err);
      throw new Error('Failed to parse PDF file');
    }
  }

  // --- API Clients ---

  private getKeys() {
    return {
      openai: this.db.getSetting('api_key_openai'),
      gemini: this.db.getSetting('api_key_gemini'),
      anthropic: this.db.getSetting('api_key_anthropic'),
      ollama: this.db.getSetting('api_key_ollama'),
    };
  }

  private async callOpenAI(prompt: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API Error: ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async callGemini(prompt: string, apiKey: string): Promise<string> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API Error: ${err}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  private async callOllama(prompt: string, baseUrl: string): Promise<string> {
    // Clean URL
    let url = baseUrl.trim();
    if (url.endsWith('/')) url = url.slice(0, -1);
    
    // Expecting OpenAI compatible endpoint like http://localhost:11434/v1
    const response = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3', // default fallback, might be overriden by specific local config later
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

  // Orchestrator to use the first available configured API
  private async generateCompletion(prompt: string): Promise<string> {
    const keys = this.getKeys();

    // Prioritize OpenAI -> Gemini -> Ollama
    if (keys.openai) {
      return this.callOpenAI(prompt, keys.openai);
    } else if (keys.gemini) {
      return this.callGemini(prompt, keys.gemini);
    } else if (keys.ollama) {
      return this.callOllama(prompt, keys.ollama);
    } else {
      throw new Error("Nenhuma chave de IA configurada. Por favor, adicione uma chave nas configurações.");
    }
  }

  // --- Features ---

  public async generateSummary(articleId: number, pdfPath: string): Promise<{ generalSummary: string; sectionSummary: string }> {
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
    
    let result = await this.generateCompletion(prompt);
    // clean up potential markdown code blocks
    result = result.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const parsed = JSON.parse(result);
      return parsed;
    } catch (err) {
      console.error("Failed to parse LLM JSON:", result);
      throw new Error("A IA não retornou um formato JSON válido.");
    }
  }

  public async massiveExtraction(articleId: number, pdfPath: string, questions: string[]): Promise<Array<{ question: string; answer: string; quote: string | null }>> {
    const text = await this.extractTextFromPdf(pdfPath);
    const truncatedText = text.substring(0, 80000);

    const questionsList = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

    const prompt = `Você é um assistente acadêmico. Baseado no texto do artigo científico abaixo, responda às perguntas fornecidas.
Para cada pergunta, você deve extrair a resposta E UM TRECHO EXATO (quote) literal do texto que comprove sua resposta. O trecho deve ser cópia fiel (case-sensitive) do PDF para que o sistema possa buscá-lo visualmente.

A sua resposta deve ser EXATAMENTE um array JSON válido (sem tags markdown de código), no seguinte formato:
[
  { "question": "pergunta 1", "answer": "resposta descritiva", "quote": "trecho exato que comprova no texto" }
]
Se não for possível encontrar a resposta no texto, deixe quote como null.

PERGUNTAS:
${questionsList}

ARTIGO:
${truncatedText}
`;

    let result = await this.generateCompletion(prompt);
    result = result.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(result);
      return parsed;
    } catch (err) {
      console.error("Failed to parse LLM JSON for massive extraction:", result);
      throw new Error("A IA não retornou um formato JSON válido para extração.");
    }
  }
}

import { describe, it, expect } from 'vitest';
import type { AIModelConfig } from '../../../types';
import { askModelsText } from '../askModels';

const config = (skill: AIModelConfig['skill'], provider: AIModelConfig['provider'], model: string): AIModelConfig => ({
  id: 1,
  skill,
  provider,
  model_name: model,
  updated_at: '2026-11-12',
});

describe('askModelsText', () => {
  it('names the model that answers (extraction) and the one that searches (embeddings)', () => {
    const text = askModelsText([
      config('summary', 'openai', 'gpt-4o'),
      config('extraction', 'gemini', 'gemini-2.5-flash'),
      config('embeddings', 'ollama', 'nomic-embed-text'),
    ]);

    expect(text.answer).toBe('gemini-2.5-flash (Google Gemini)');
    expect(text.search).toBe('nomic-embed-text (Ollama)');
  });

  it('says what the app does when no model was chosen for a task', () => {
    const text = askModelsText([config('summary', 'openai', 'gpt-4o')]);

    expect(text.answer).toContain('o primeiro provedor com chave');
    expect(text.search).toBe('text-embedding-3-small (OpenAI), o padrão');
  });
});

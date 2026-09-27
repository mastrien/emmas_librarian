import { describe, expect, it } from 'vitest';
import { modelSuggestions, suggestedModelFor } from '../aiModelSuggestions';

describe('modelSuggestions', () => {
  it('offers current Claude models for text skills', () => {
    expect(modelSuggestions('summary', 'anthropic')).toEqual(['claude-sonnet-5', 'claude-haiku-4-5']);
  });

  it('offers embedding models only for the embeddings skill', () => {
    expect(modelSuggestions('embeddings', 'openai')).toEqual(['text-embedding-3-small', 'text-embedding-3-large']);
    expect(modelSuggestions('metadata', 'openai')).toEqual(['gpt-4o-mini', 'gpt-4o']);
  });

  it('returns no suggestions for a provider without models for the skill', () => {
    expect(modelSuggestions('embeddings', 'anthropic')).toEqual([]);
  });
});

describe('suggestedModelFor', () => {
  it('pre-fills the first suggestion of the new provider', () => {
    expect(suggestedModelFor('metadata', 'ollama', 'gpt-4o-mini')).toBe('llama3.1');
  });

  it('keeps the current model when the provider has nothing to suggest', () => {
    expect(suggestedModelFor('embeddings', 'anthropic', 'text-embedding-3-small')).toBe('text-embedding-3-small');
  });
});

import { describe, expect, it } from 'vitest';
import { providerDisplayName } from '../providerNames';

describe('providerDisplayName', () => {
  it.each([
    ['ollama_cloud', 'Ollama Cloud'],
    ['ollama', 'Ollama'],
    ['local', 'Local Embutido'],
    ['gemini', 'Google Gemini'],
    ['openai', 'OpenAI'],
    ['anthropic', 'Anthropic'],
    ['mistral', 'mistral'],
  ])('shows %s as %s', (provider, shown) => {
    expect(providerDisplayName(provider)).toBe(shown);
  });
});

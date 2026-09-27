import type { AIProvider, AISkill } from '../../types';

type SuggestionTable = Partial<Record<AIProvider, string[]>>;

// First entry of each list is what the settings page pre-fills when the provider changes.
// Keep in sync with tutorial chapter 5 (landing_page/tutoriais.html, "#ia-rag").
const TEXT_MODEL_SUGGESTIONS: SuggestionTable = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  openai: ['gpt-4o-mini', 'gpt-4o'],
  ollama_cloud: ['gpt-oss:120b-cloud', 'gpt-oss:120b', 'deepseek-v4-pro', 'qwen3.5:397b'],
  ollama: ['llama3.1', 'llama3.1:70b', 'mistral'],
  anthropic: ['claude-sonnet-5', 'claude-haiku-4-5'],
};

const EMBEDDING_MODEL_SUGGESTIONS: SuggestionTable = {
  local: ['all-MiniLM-L6-v2'],
  llama_cpp: ['all-MiniLM-L6-v2'],
  gemini: ['text-embedding-004'],
  openai: ['text-embedding-3-small', 'text-embedding-3-large'],
  ollama: ['nomic-embed-text', 'all-minilm'],
};

/**
 * Model names offered in the settings autocomplete for a skill/provider pair.
 *
 * @example modelSuggestions('summary', 'anthropic') // ['claude-sonnet-5', 'claude-haiku-4-5']
 */
export function modelSuggestions(skill: AISkill, provider: AIProvider): string[] {
  const table = skill === 'embeddings' ? EMBEDDING_MODEL_SUGGESTIONS : TEXT_MODEL_SUGGESTIONS;
  return table[provider] ?? [];
}

/**
 * Model pre-filled when the user switches a skill to another provider; keeps the current
 * name when there is nothing to suggest (e.g. Anthropic has no embedding models).
 *
 * @example suggestedModelFor('metadata', 'ollama', 'gpt-4o-mini') // 'llama3.1'
 */
export function suggestedModelFor(skill: AISkill, provider: AIProvider, currentModel: string): string {
  return modelSuggestions(skill, provider)[0] ?? currentModel;
}

// One map of the AI providers' names as the screens show them. There were three, and the investigation's lacked
// Ollama Cloud, so its header read "ollama_cloud" (found while taking the 1.3.0 tutorial captures).
const PROVIDER_NAMES: Record<string, string> = {
  local: 'Local Embutido',
  llama_cpp: 'Local Embutido',
  ollama: 'Ollama',
  ollama_cloud: 'Ollama Cloud',
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

/**
 * A provider id as the screens name it; one it does not know is shown as it is.
 *
 * @example providerDisplayName('ollama_cloud') // 'Ollama Cloud'
 */
export const providerDisplayName = (provider: string): string => PROVIDER_NAMES[provider] ?? provider;

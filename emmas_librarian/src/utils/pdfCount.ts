/**
 * A number of PDFs as a sentence says it.
 *
 * @example pdfCount(1) // '1 PDF'
 */
export const pdfCount = (count: number): string => (count === 1 ? '1 PDF' : `${count} PDFs`);

const PROVIDER_NAMES: Record<string, string> = {
  local: 'Local Embutido',
  ollama: 'Ollama',
  ollama_cloud: 'Ollama Cloud',
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

/**
 * A stored model id as the settings show it.
 *
 * @example embeddingModelName('ollama/nomic-embed-text') // 'nomic-embed-text (Ollama)'
 */
export function embeddingModelName(modelId: string): string {
  const slash = modelId.indexOf('/');
  if (slash < 0) return modelId;
  const provider = modelId.slice(0, slash);
  return `${modelId.slice(slash + 1)} (${PROVIDER_NAMES[provider] ?? provider})`;
}

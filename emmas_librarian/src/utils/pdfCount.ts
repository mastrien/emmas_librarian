import { providerDisplayName } from './providerNames';

/**
 * A number of PDFs as a sentence says it.
 *
 * @example pdfCount(1) // '1 PDF'
 */
export const pdfCount = (count: number): string => (count === 1 ? '1 PDF' : `${count} PDFs`);

/**
 * A stored model id as the settings show it.
 *
 * @example embeddingModelName('ollama/nomic-embed-text') // 'nomic-embed-text (Ollama)'
 */
export function embeddingModelName(modelId: string): string {
  const slash = modelId.indexOf('/');
  if (slash < 0) return modelId;
  const provider = modelId.slice(0, slash);
  return `${modelId.slice(slash + 1)} (${providerDisplayName(provider)})`;
}

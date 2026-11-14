import type { AIModelConfig, AISkill } from '../../types';
import { providerDisplayName } from '../../utils/providerNames';

/** What "Perguntar aos projetos" says about the two models it uses. */
export interface AskModelsText {
  /** The model that writes the answer (the "extraction" task of the settings). */
  answer: string;
  /** The model that turns the question and the PDFs into vectors, to find the passages (the "embeddings" task). */
  search: string;
}

const find = (configs: AIModelConfig[], skill: AISkill) => configs.find((c) => c.skill === skill);

const named = (config: AIModelConfig) => `${config.model_name} (${providerDisplayName(config.provider)})`;

/**
 * The models behind a question, named as the settings name them. A task with no model chosen says what the app does
 * then, as the main process does: the first provider with a key answers, and OpenAI's small model searches.
 *
 * @example askModelsText([{ skill: 'extraction', provider: 'gemini', model_name: 'gemini-2.5-flash', ... }])
 *   // { answer: 'gemini-2.5-flash (Google Gemini)', search: 'text-embedding-3-small (OpenAI), o padrão' }
 */
export function askModelsText(configs: AIModelConfig[]): AskModelsText {
  const answer = find(configs, 'extraction');
  const search = find(configs, 'embeddings');
  return {
    answer: answer
      ? named(answer)
      : 'o primeiro provedor com chave (OpenAI, Gemini, Ollama), pois nenhum foi escolhido',
    search: search ? named(search) : 'text-embedding-3-small (OpenAI), o padrão',
  };
}

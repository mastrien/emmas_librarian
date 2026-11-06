import type { ScreeningCriteria } from '../types/screeningSuggestion';
import { providerDisplayName } from './providerNames';

/**
 * The criteria as an engine reads them, and as they are compared: a suggestion made with other ones says so.
 *
 * @example criteriaSnapshot({ inclusion: 'adultos', exclusion: '' }) // 'Incluir: adultos\nExcluir: '
 */
export const criteriaSnapshot = ({ inclusion, exclusion }: ScreeningCriteria): string =>
  `Incluir: ${inclusion.trim()}\nExcluir: ${exclusion.trim()}`;

/**
 * Whether there is anything to compare an article with.
 *
 * @example hasCriteria({ inclusion: ' ', exclusion: '' }) // false
 */
export const hasCriteria = ({ inclusion, exclusion }: ScreeningCriteria): boolean =>
  inclusion.trim() !== '' || exclusion.trim() !== '';

/**
 * The provider as a sentence names it, for saying where the text goes: a local Ollama says so, since then the text
 * stays on the computer.
 *
 * @example providerName('gemini') // 'Google Gemini'
 */
export const providerName = (provider: string): string =>
  provider === 'ollama' ? 'Ollama (local)' : providerDisplayName(provider);

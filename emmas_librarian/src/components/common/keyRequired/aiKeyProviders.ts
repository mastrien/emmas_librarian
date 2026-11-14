export type AiKeyProvider = 'gemini' | 'openai' | 'anthropic';

export const AI_KEY_PROVIDERS: { value: AiKeyProvider; label: string }[] = [
  { value: 'gemini', label: 'Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
];

/**
 * The setting that holds a provider's key (the same ones the Settings page writes).
 *
 * @example aiKeySettingName('gemini') // 'api_key_gemini'
 */
export function aiKeySettingName(provider: AiKeyProvider): string {
  return `api_key_${provider}`;
}

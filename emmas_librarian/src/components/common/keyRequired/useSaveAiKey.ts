import { useState } from 'react';
import { useProjectService } from '../../../contexts/ServicesContext';
import { aiKeySettingName, type AiKeyProvider } from './aiKeyProviders';

/**
 * The state of the key window's form and the save: the key goes to the setting the Settings page reads, trimmed, and
 * `onSaved` runs only after it was written (a failed save keeps the window open with what was typed).
 *
 * @example const key = useSaveAiKey(() => closeAndRetry()); key.save();
 */
export function useSaveAiKey(onSaved: () => void) {
  const projectService = useProjectService();
  const [provider, setProvider] = useState<AiKeyProvider>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const trimmed = apiKey.trim();

  const save = async () => {
    if (!trimmed) return;
    try {
      await projectService.setSetting(aiKeySettingName(provider), trimmed);
      onSaved();
    } catch (err) {
      setError(`Não foi possível salvar a chave: ${(err as Error)?.message ?? String(err)}`);
    }
  };

  return { provider, setProvider, apiKey, setApiKey, canSave: trimmed.length > 0, error, save };
}

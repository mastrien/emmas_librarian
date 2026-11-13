import React from 'react';
import { SegmentedControl } from '../SegmentedControl';
import { TextField } from '../fields';
import { AI_KEY_PROVIDERS, type AiKeyProvider } from './aiKeyProviders';

interface AiKeyFormProps {
  provider: AiKeyProvider;
  apiKey: string;
  onProviderChange: (provider: AiKeyProvider) => void;
  onKeyChange: (apiKey: string) => void;
  /** Enter in the field saves, like the button. */
  onSubmit: () => void;
}

/**
 * The key window's own field (board 181): which provider and its key, so the person need not go to Settings.
 *
 * @example <AiKeyForm provider="gemini" apiKey={key} onProviderChange={setProvider} onKeyChange={setKey} onSubmit={save} />
 */
export const AiKeyForm: React.FC<AiKeyFormProps> = (props) => (
  <div className="key-required-form">
    <SegmentedControl<AiKeyProvider>
      label="Provedor"
      options={AI_KEY_PROVIDERS}
      value={props.provider}
      onChange={props.onProviderChange}
    />
    <TextField
      label={`Chave do ${AI_KEY_PROVIDERS.find((p) => p.value === props.provider)?.label}`}
      type="password"
      autoComplete="off"
      autoFocus
      value={props.apiKey}
      onChange={(e) => props.onKeyChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && props.onSubmit()}
    />
  </div>
);

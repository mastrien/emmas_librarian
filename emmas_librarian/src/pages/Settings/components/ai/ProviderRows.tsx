import React, { useId } from 'react';
import { Check, Key } from 'lucide-react';

interface ProviderRowProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Secrets are masked; the Ollama URL is not. */
  secret?: boolean;
  title?: string;
  /** A line under the field, for what the provider asks of the person (where to get the key, a limit). */
  hint?: React.ReactNode;
}

/**
 * What a provider's field says about it (board 170): no key, or configured. The board's third state, "respondendo",
 * needs a call to the provider and is not made here.
 *
 * @example providerBadge('sk-1') // { tone: 'ok', text: 'configurada' }
 */
export function providerBadge(value: string): { tone: 'ok' | 'none'; text: string } {
  return value.trim() ? { tone: 'ok', text: 'configurada' } : { tone: 'none', text: 'sem chave' };
}

/**
 * One provider on its line (board 170): name, the key or address field, and whether it is set.
 *
 * @example <ProviderRow name="OpenAI" value={key} onChange={setKey} placeholder="sk-…" />
 */
export const ProviderRow: React.FC<ProviderRowProps> = ({
  name,
  value,
  onChange,
  placeholder,
  secret = true,
  title,
  hint,
}) => {
  const id = useId();
  const badge = providerBadge(value);
  return (
    <div className="ai-provider">
      <label htmlFor={id} className="ai-provider__name">
        {name}
      </label>
      <div className="api-key-input-wrap">
        {secret && (
          <span className="api-key-icon">
            <Key size={14} aria-hidden="true" />
          </span>
        )}
        <input
          id={id}
          type={secret ? 'password' : 'text'}
          className="api-key-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          title={title}
        />
      </div>
      <span className={`ai-badge ai-badge--${badge.tone}`}>
        {badge.tone === 'ok' && <Check size={12} aria-hidden="true" />}
        {badge.text}
      </span>
      {hint && <p className="ai-provider__hint">{hint}</p>}
    </div>
  );
};

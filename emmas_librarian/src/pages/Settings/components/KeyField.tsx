import React, { useId } from 'react';
import { Key } from 'lucide-react';
import './settings.css';

interface KeyFieldProps {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Secrets are masked; endpoints such as the Ollama URL are not. */
  secret?: boolean;
  title?: string;
  hint?: React.ReactNode;
}

/**
 * A credential (or endpoint) input with a key icon and an optional hint below: the bases' API keys and the AI
 * providers' keys. They were two copies of the same field (ApiKeyField and the AI KeyField) until Arca 134.
 *
 * @example <KeyField label="OpenAI API Key" value={key} onChange={setKey} placeholder="sk-..." />
 */
export const KeyField: React.FC<KeyFieldProps> = ({ label, value, onChange, placeholder, secret = true, ...rest }) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="settings-label">
        {label}
      </label>
      <div className="api-key-input-wrap">
        <div className="api-key-icon">
          <Key size={18} />
        </div>
        <input
          id={id}
          type={secret ? 'password' : 'text'}
          className="api-key-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          title={rest.title}
        />
      </div>
      {rest.hint && <p className="settings-hint">{rest.hint}</p>}
    </div>
  );
};

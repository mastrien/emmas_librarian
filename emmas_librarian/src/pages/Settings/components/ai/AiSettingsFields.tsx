import React from 'react';
import { Key, Save, CheckCircle } from 'lucide-react';

interface KeyFieldProps {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Secrets are masked; endpoints such as the Ollama URL are not. */
  secret?: boolean;
  title?: string;
}

/**
 * Provider credential (or endpoint) input with a key icon.
 *
 * Usage:
 *   <KeyField label="OpenAI API Key" value={key} onChange={setKey} placeholder="sk-..." />
 */
export const KeyField: React.FC<KeyFieldProps> = ({ label, value, onChange, placeholder, secret = true, title }) => (
  <div>
    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>
      {label}
    </label>
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          left: '1rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
        }}
      >
        <Key size={18} />
      </div>
      <input
        type={secret ? 'password' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        title={title}
        style={{
          width: '100%',
          padding: '0.8rem 1rem 0.8rem 2.8rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-main)',
          color: 'var(--text-main)',
          outline: 'none',
        }}
      />
    </div>
  </div>
);

export const smallLabelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.5rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
};

export const settingsInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.8rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-surface)',
  color: 'var(--text-main)',
  outline: 'none',
};

/**
 * Numeric RAG tuning parameter (chunk size, overlap, top K).
 *
 * Usage:
 *   <NumberSetting label="Overlap (caracteres)" value={overlap} onChange={setOverlap} />
 */
export const NumberSetting: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div>
    <label style={smallLabelStyle}>{label}</label>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-field"
      style={settingsInputStyle}
    />
  </div>
);

interface SaveSettingsButtonProps {
  onClick: () => void;
  saving: boolean;
  saved: boolean;
  idleLabel: string;
  iconSize: number;
  iconStyle?: React.CSSProperties;
}

/**
 * Save button that reflects the saving / saved state.
 *
 * Usage:
 *   <SaveSettingsButton onClick={save} saving={saving} saved={saved} idleLabel="Salvar Chaves" iconSize={20} />
 */
export const SaveSettingsButton: React.FC<SaveSettingsButtonProps> = ({
  onClick,
  saving,
  saved,
  idleLabel,
  iconSize,
  iconStyle,
}) => (
  <button onClick={onClick} className="btn-primary" disabled={saving} style={{ minWidth: '150px' }}>
    {saved ? <CheckCircle size={iconSize} style={iconStyle} /> : <Save size={iconSize} style={iconStyle} />}
    {saving ? 'Salvando...' : saved ? 'Salvo!' : idleLabel}
  </button>
);

import React, { useId } from 'react';
import { Key } from 'lucide-react';

interface ApiKeysSettingsProps {
  scopusKey: string;
  setScopusKey: (v: string) => void;
  wosKey: string;
  setWosKey: (v: string) => void;
  openAlexKey: string;
  setOpenAlexKey: (v: string) => void;
}

interface ApiKeyFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  hint?: React.ReactNode;
}

/** A password field for one API key, with the key icon and an optional hint below. */
const ApiKeyField: React.FC<ApiKeyFieldProps> = ({ label, placeholder, value, onChange, hint }) => {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}
      >
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
          id={id}
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
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
      {hint && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.4rem 0 0' }}>{hint}</p>}
    </div>
  );
};

/**
 * Keys for the bibliographic bases: Scopus and WoS need one to be searched at all; OpenAlex works without,
 * and its free key only raises the daily budget.
 *
 * Usage:
 *   <ApiKeysSettings scopusKey={s} setScopusKey={setS} wosKey={w} setWosKey={setW} openAlexKey={o} setOpenAlexKey={setO} />
 */
export const ApiKeysSettings: React.FC<ApiKeysSettingsProps> = (props) => {
  return (
    <div className="card" style={{ padding: '2rem' }}>
      <h2
        style={{
          fontSize: '1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        Chaves de API
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Insira suas chaves de API para habilitar buscas no Scopus e Web of Science. As chaves são armazenadas localmente
        no seu banco de dados.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <ApiKeyField
          label="Scopus API Key"
          placeholder="Insira sua chave Scopus..."
          value={props.scopusKey}
          onChange={props.setScopusKey}
        />
        <ApiKeyField
          label="Web of Science API Key"
          placeholder="Insira sua chave WoS..."
          value={props.wosKey}
          onChange={props.setWosKey}
        />
        <ApiKeyField
          label="OpenAlex API Key (opcional)"
          placeholder="Insira sua chave OpenAlex..."
          value={props.openAlexKey}
          onChange={props.setOpenAlexKey}
          hint="A OpenAlex funciona sem chave. Com a chave gratuita, o limite diário de buscas fica 10 vezes maior."
        />
      </div>
    </div>
  );
};

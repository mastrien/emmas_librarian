import React, { useId } from 'react';
import { Key } from 'lucide-react';
import { IEEE_EXPERIMENTAL_NOTE } from '../../Search/searchQueries';
import { SettingsCard } from './SettingsCard';

interface ApiKeysSettingsProps {
  scopusKey: string;
  setScopusKey: (v: string) => void;
  wosKey: string;
  setWosKey: (v: string) => void;
  openAlexKey: string;
  setOpenAlexKey: (v: string) => void;
  ieeeKey: string;
  setIeeeKey: (v: string) => void;
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
      <label htmlFor={id} className="settings-label">
        {label}
      </label>
      <div className="api-key-input-wrap">
        <div className="api-key-icon">
          <Key size={18} />
        </div>
        <input
          id={id}
          type="password"
          className="api-key-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      {hint && <p className="settings-hint">{hint}</p>}
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
export const ApiKeysSettings: React.FC<ApiKeysSettingsProps> = (props) => (
  <SettingsCard
    title="Chaves de API"
    spacing="wide"
    description="Insira suas chaves de API para habilitar buscas no Scopus, na Web of Science e na IEEE Xplore. As chaves são armazenadas localmente no seu banco de dados."
  >
    <div className="settings-stack settings-stack--wide">
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
      <ApiKeyField
        label="IEEE Xplore API Key (experimental)"
        placeholder="Insira sua chave IEEE..."
        value={props.ieeeKey}
        onChange={props.setIeeeKey}
        hint={`Gratuita, com cadastro em developer.ieee.org. A IEEE aprova cada chave manualmente. ${IEEE_EXPERIMENTAL_NOTE}`}
      />
    </div>
  </SettingsCard>
);

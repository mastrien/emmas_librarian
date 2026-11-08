import React from 'react';
import { IEEE_EXPERIMENTAL_NOTE } from '../../Search/searchQueries';
import { SettingsCard } from './SettingsCard';
import { KeyField } from './KeyField';

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
      <KeyField
        label="Scopus API Key"
        placeholder="Insira sua chave Scopus..."
        value={props.scopusKey}
        onChange={props.setScopusKey}
      />
      <KeyField
        label="Web of Science API Key"
        placeholder="Insira sua chave WoS..."
        value={props.wosKey}
        onChange={props.setWosKey}
      />
      <KeyField
        label="OpenAlex API Key (opcional)"
        placeholder="Insira sua chave OpenAlex..."
        value={props.openAlexKey}
        onChange={props.setOpenAlexKey}
        hint="A OpenAlex funciona sem chave. Com a chave gratuita, o limite diário de buscas fica 10 vezes maior."
      />
      <KeyField
        label="IEEE Xplore API Key (experimental)"
        placeholder="Insira sua chave IEEE..."
        value={props.ieeeKey}
        onChange={props.setIeeeKey}
        hint={`Gratuita, com cadastro em developer.ieee.org. A IEEE aprova cada chave manualmente. ${IEEE_EXPERIMENTAL_NOTE}`}
      />
    </div>
  </SettingsCard>
);

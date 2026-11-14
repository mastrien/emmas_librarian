import React, { useState } from 'react';
import { Key } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { ModalFooter } from '../../components/common/ModalFooter';
import { Button } from '../../components/common/Button';
import { TextField } from '../../components/common/fields';
import { LegalReviewNotice } from '../../components/common/LegalReviewNotice';
import { IEEE_AI_WARNING } from '../Terms/termsContent';
import { useProjectService } from '../../contexts/ServicesContext';
import { API_KEY_SETTINGS, isKeyedDatabase, SEARCH_DATABASES } from './searchQueries';
import '../../components/common/keyRequired/keyRequired.css';

interface ApiKeyRequiredDialogProps {
  database: string;
  onCancel: () => void;
  onOpenSettings: () => void;
  /** Called after the key was written, so the page can use the base right away. */
  onKeySaved: (database: string, apiKey: string) => void;
}

/**
 * Asks for the key of a keyed base (Scopus, Web of Science, IEEE Xplore) in the window itself (board 181), with a
 * way out to the settings page. The key goes to the setting the Settings page reads.
 *
 * @example
 *   {missingKeyDb && <ApiKeyRequiredDialog database="wos" onCancel={close} onOpenSettings={goToSettings} onKeySaved={use} />}
 */
export const ApiKeyRequiredDialog: React.FC<ApiKeyRequiredDialogProps> = (props) => {
  const projectService = useProjectService();
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const label = SEARCH_DATABASES.find((d) => d.id === props.database)?.label ?? props.database;
  const trimmed = apiKey.trim();

  const save = async () => {
    if (!trimmed || !isKeyedDatabase(props.database)) return;
    try {
      await projectService.setSetting(API_KEY_SETTINGS[props.database], trimmed);
      props.onKeySaved(props.database, trimmed);
    } catch (err) {
      setError(`Não foi possível salvar a chave: ${(err as Error)?.message ?? String(err)}`);
    }
  };

  return (
    <Modal
      label="Chave de API Necessária"
      title="Chave de API Necessária"
      onClose={props.onCancel}
      width={450}
      icon={<Key size={18} aria-hidden="true" />}
      tone="info"
    >
      <p className="key-required-text">
        Para realizar buscas na <strong>{label}</strong>, você precisa primeiro de uma chave de API. Cole a sua aqui ou
        configure nas configurações do sistema.
      </p>
      <div className="key-required-form">
        <TextField
          label={`Chave da ${label}`}
          type="password"
          autoComplete="off"
          autoFocus
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </div>
      {props.database === 'ieee' && <LegalReviewNotice detail={IEEE_AI_WARNING} compact />}
      {error && (
        <p role="alert" className="key-required-error">
          {error}
        </p>
      )}
      <ModalFooter>
        <Button variant="ghost" onClick={props.onCancel}>
          Cancelar
        </Button>
        <Button variant="ghost" onClick={props.onOpenSettings}>
          Configurações
        </Button>
        <Button variant="primary" disabled={!trimmed} onClick={save}>
          {`Salvar e usar a ${label}`}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

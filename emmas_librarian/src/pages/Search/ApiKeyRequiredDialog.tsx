import React from 'react';
import { KeyRequiredModal } from '../../components/common/keyRequired/KeyRequiredModal';
import { SEARCH_DATABASES } from './searchQueries';

interface ApiKeyRequiredDialogProps {
  database: string;
  onCancel: () => void;
  onOpenSettings: () => void;
}

/**
 * Explains that a keyed base (Scopus, Web of Science, IEEE Xplore) needs an API key and links to the settings page.
 *
 * Usage:
 *   {missingKeyDb && <ApiKeyRequiredDialog database="wos" onCancel={close} onOpenSettings={() => navigate('/settings')} />}
 */
export const ApiKeyRequiredDialog: React.FC<ApiKeyRequiredDialogProps> = ({ database, onCancel, onOpenSettings }) => (
  <KeyRequiredModal title="Chave de API Necessária" onCancel={onCancel} onOpenSettings={onOpenSettings}>
    Para realizar buscas na <strong>{SEARCH_DATABASES.find((d) => d.id === database)?.label ?? database}</strong>, você
    precisa primeiro configurar sua chave de API nas configurações do sistema.
  </KeyRequiredModal>
);

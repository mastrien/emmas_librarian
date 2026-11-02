import React from 'react';
import type { AutosaveStatus } from '../useSettingsAutosave';

const TEXT: Record<AutosaveStatus, string> = {
  idle: 'As alterações são salvas automaticamente.',
  saving: 'Salvando…',
  saved: 'Alterações salvas.',
  error: 'Não foi possível salvar uma alteração. Tente de novo.',
};

/**
 * The line beside the settings title that says how saving goes, in small text and without a box. It is a live
 * region, so a screen reader hears it change.
 *
 * @example <AutosaveNotice status={autosave.status} />
 */
export const AutosaveNotice: React.FC<{ status: AutosaveStatus }> = ({ status }) => (
  <span
    role="status"
    aria-live="polite"
    style={{
      marginLeft: 'auto',
      fontSize: '0.85rem',
      color: status === 'error' ? 'var(--color-danger)' : 'var(--text-muted)',
    }}
  >
    {TEXT[status]}
  </span>
);

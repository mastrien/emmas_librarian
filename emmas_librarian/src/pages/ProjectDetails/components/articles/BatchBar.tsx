import React from 'react';
import { Archive, CheckCircle, CopyPlus, X } from 'lucide-react';

interface BatchBarProps {
  selectedCount: number;
  allOnPageSelected: boolean;
  onToggleAll: () => void;
  onMarkRead: () => void;
  onArchive: () => void;
  onCite: () => void;
  onExit: () => void;
}

/**
 * Takes the place of the result line while multi-select is on: how many articles are selected and
 * what can be done to all of them at once.
 *
 * @example {selecting && <BatchBar selectedCount={3} allOnPageSelected={false} ... />}
 */
export const BatchBar: React.FC<BatchBarProps> = ({
  selectedCount,
  allOnPageSelected,
  onToggleAll,
  onMarkRead,
  onArchive,
  onCite,
  onExit,
}) => {
  const none = selectedCount === 0;
  return (
    <div className="batch-bar" role="region" aria-label="Ações para os artigos selecionados">
      <span className="batch-bar__count" aria-live="polite">
        {none ? 'Nenhum selecionado' : `${selectedCount} ${selectedCount === 1 ? 'selecionado' : 'selecionados'}`}
      </span>
      <button type="button" onClick={onToggleAll}>
        {allOnPageSelected ? 'Desmarcar todos' : 'Selecionar todos'}
      </button>
      <button type="button" onClick={onMarkRead} disabled={none}>
        <CheckCircle size={15} /> Marcar como lido
      </button>
      <button type="button" onClick={onArchive} disabled={none}>
        <Archive size={15} /> Arquivar…
      </button>
      <button type="button" onClick={onCite} disabled={none}>
        <CopyPlus size={15} /> Citar em massa
      </button>
      <button type="button" onClick={onExit} aria-label="Sair da seleção" title="Sair da seleção">
        <X size={15} />
      </button>
    </div>
  );
};

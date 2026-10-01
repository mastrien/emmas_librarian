import React from 'react';
import { Archive, CheckCircle, CopyPlus, Globe, X } from 'lucide-react';

interface BatchBarProps {
  selectedCount: number;
  allOnPageSelected: boolean;
  onToggleAll: () => void;
  onMarkRead: () => void;
  onArchive: () => void;
  onCite: () => void;
  onExit: () => void;
  onFetchOpenAccess: () => void;
  onCancelOpenAccess: () => void;
  /** While open access PDFs are downloading: how many of the selection are done. */
  openAccessProgress: { done: number; total: number } | null;
}

// Progress stays inside the bar (option V1 of the mock-up): the table below does not move while it runs.
const DownloadProgress: React.FC<{ progress: { done: number; total: number }; onCancel: () => void }> = ({
  progress,
  onCancel,
}) => (
  <>
    <span className="batch-bar__progress" role="status">
      Baixando {Math.min(progress.done + 1, progress.total)} de {progress.total}…
      <span className="batch-bar__meter" aria-hidden="true">
        <span style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
      </span>
    </span>
    <button type="button" onClick={onCancel}>
      Cancelar
    </button>
  </>
);

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
  onFetchOpenAccess,
  onCancelOpenAccess,
  openAccessProgress,
}) => {
  const none = selectedCount === 0;
  const downloading = openAccessProgress !== null;
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
      {downloading ? (
        <DownloadProgress progress={openAccessProgress} onCancel={onCancelOpenAccess} />
      ) : (
        <button type="button" onClick={onFetchOpenAccess} disabled={none}>
          <Globe size={15} /> Baixar PDFs abertos
        </button>
      )}
      <button type="button" onClick={onExit} aria-label="Sair da seleção" title="Sair da seleção">
        <X size={15} />
      </button>
    </div>
  );
};

import React from 'react';
import { Archive, CheckCircle, CopyPlus, Globe, Network, X } from 'lucide-react';
import './articlesList.css';

interface BatchBarProps {
  selectedCount: number;
  /** Whether every article of the filtered list, on every page, is selected. */
  allSelected: boolean;
  onToggleAll: () => void;
  onMarkRead: () => void;
  onArchive: () => void;
  onCite: () => void;
  onExploreCitations: () => void;
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
        <span style={{ '--done': `${Math.round((progress.done / progress.total) * 100)}%` } as React.CSSProperties} />
      </span>
    </span>
    <button type="button" onClick={onCancel}>
      Cancelar
    </button>
  </>
);

interface BarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
}

// One row, always (validation, step 7): when the bar is narrow or a download is running, the label turns into a
// tooltip and only the icon stays; the label remains in the accessible name.
const BarButton: React.FC<BarButtonProps> = ({ icon, label, onClick, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled} title={label}>
    {icon} <span className="batch-bar__label">{label}</span>
  </button>
);

/**
 * Takes the place of the result line while multi-select is on: how many articles are selected and
 * what can be done to all of them at once.
 *
 * @example {selecting && <BatchBar selectedCount={3} allSelected={false} ... />}
 */
export const BatchBar: React.FC<BatchBarProps> = ({
  selectedCount,
  allSelected,
  onToggleAll,
  onMarkRead,
  onArchive,
  onCite,
  onExploreCitations,
  onExit,
  onFetchOpenAccess,
  onCancelOpenAccess,
  openAccessProgress,
}) => {
  const none = selectedCount === 0;
  const downloading = openAccessProgress !== null;
  return (
    <div
      className={`batch-bar${downloading ? ' batch-bar--busy' : ''}`}
      role="region"
      aria-label="Ações para os artigos selecionados"
    >
      <span className="batch-bar__count" aria-live="polite">
        {none ? 'Nenhum selecionado' : `${selectedCount} ${selectedCount === 1 ? 'selecionado' : 'selecionados'}`}
      </span>
      <button type="button" onClick={onToggleAll}>
        {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
      </button>
      <BarButton icon={<CheckCircle size={15} />} label="Marcar como lido" onClick={onMarkRead} disabled={none} />
      <BarButton icon={<Archive size={15} />} label="Arquivar…" onClick={onArchive} disabled={none} />
      <BarButton icon={<Network size={16} />} label="Explorar citações" onClick={onExploreCitations} disabled={none} />
      <BarButton icon={<CopyPlus size={15} />} label="Citar em massa" onClick={onCite} disabled={none} />
      {downloading ? (
        <DownloadProgress progress={openAccessProgress} onCancel={onCancelOpenAccess} />
      ) : (
        <BarButton icon={<Globe size={15} />} label="Baixar PDFs abertos" onClick={onFetchOpenAccess} disabled={none} />
      )}
      <button type="button" onClick={onExit} aria-label="Sair da seleção" title="Sair da seleção">
        <X size={15} />
      </button>
    </div>
  );
};

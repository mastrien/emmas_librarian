import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { SearchHistoryItem, SearchReportFormat } from '../../types';
import { Modal } from '../common/Modal';
import { useSearchMonitors } from './searchHistory/SearchMonitorControl';
import { SearchStrategyExport } from './searchHistory/SearchStrategyExport';
import { HistoryEntry } from './searchHistory/HistoryEntry';
import './searchHistory/searchHistory.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  history: SearchHistoryItem[];
  embedded?: boolean;
  onRevertSearch?: (searchId: number) => void;
  // Enables "Nova busca a partir desta", which opens the search page preloaded with that search.
  projectId?: number;
  // Shows "Exportar estratégia de busca" (#45); saves the report and answers the path (null if cancelled).
  onExportStrategy?: (format: SearchReportFormat) => Promise<string | null>;
}

type HistoryContentProps = Pick<Props, 'history' | 'onRevertSearch' | 'projectId'>;

const DESCRIPTION = 'Registro de todas as buscas realizadas neste projeto.';

const HistoryContent: React.FC<HistoryContentProps> = ({ history, onRevertSearch, projectId }) => {
  const monitoring = useSearchMonitors(projectId);
  return (
    <div className="history-content">
      {monitoring.error && (
        <div role="alert" className="history-monitor-error">
          {monitoring.error}
        </div>
      )}
      {history.length === 0 ? (
        <div className="history-empty">Nenhuma busca registrada ainda.</div>
      ) : (
        <div className="history-list">
          {history.map((item) => (
            <HistoryEntry
              key={item.id}
              item={item}
              onRevertSearch={onRevertSearch}
              projectId={projectId}
              monitor={monitoring.monitors.find((m) => m.search_id === item.id)}
              onMonitorChange={(days) => void monitoring.set(item.id, days)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * The project's search history: every search, import and manual addition, with undo, re-run and monitoring.
 * Shown as the project's "Histórico" tab (embedded) or in a window.
 *
 * @example <SearchHistoryModal isOpen embedded history={history} projectId={4} onRevertSearch={revert} onClose={close} />
 */
export const SearchHistoryModal: React.FC<Props> = (props) => {
  const { isOpen, onClose, history, embedded, onRevertSearch, projectId, onExportStrategy } = props;
  if (!isOpen) return null;
  const exportButtons = onExportStrategy && <SearchStrategyExport onExport={onExportStrategy} />;
  const content = <HistoryContent history={history} onRevertSearch={onRevertSearch} projectId={projectId} />;

  if (embedded) {
    return (
      <div className="fade-in">
        <div className="history-heading">
          <h2>
            <RotateCcw size={24} /> Histórico de Buscas
          </h2>
          <p>{DESCRIPTION}</p>
          {exportButtons}
        </div>
        {content}
      </div>
    );
  }

  return (
    <Modal
      label="Histórico de Buscas"
      title="Histórico de Buscas"
      description={DESCRIPTION}
      onClose={onClose}
      width={900}
    >
      {exportButtons}
      {content}
    </Modal>
  );
};

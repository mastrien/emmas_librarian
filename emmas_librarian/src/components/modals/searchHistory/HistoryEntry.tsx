import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Search, ChevronRight, RotateCcw, Pencil, RefreshCw } from 'lucide-react';
import type { SearchBreakdown, SearchHistoryItem, SearchMonitor } from '../../../types';
import { restoreSearch } from '../../../pages/Search/searchQueries';
import { isMonitorResult, type MonitorInterval } from '../../../utils/searchMonitor';
import { useDialogs } from '../../common/dialogs/DialogProvider';
import { databaseLabel } from '../searchSummary/SearchBreakdownList';
import { HistoryBreakdown } from './HistoryBreakdown';
import { SearchMonitorControl } from './SearchMonitorControl';
import { historyLimitText, parseStoredObject, sortLabel } from './historyDetails';
import { undoTexts } from './undoTexts';
import './searchHistory.css';

export interface HistoryEntryProps {
  item: SearchHistoryItem;
  onRevertSearch?: (searchId: number) => void;
  /** Enables "Rodar de novo", "Nova busca a partir desta" and monitoring. */
  projectId?: number;
  monitor?: SearchMonitor;
  onMonitorChange: (intervalDays: MonitorInterval | null) => void;
}

// Only database searches can be rebuilt; imports and manual additions have no query to reuse.
export const SearchFromLinks: React.FC<{ projectId: number; item: SearchHistoryItem }> = ({ projectId, item }) =>
  restoreSearch(item) ? (
    <>
      <Link
        to={`/projects/${projectId}/search?from=${item.id}&rerun=1`}
        title="Rodar esta busca de novo, olhando o que saiu depois dela"
        className="history-link"
      >
        <RefreshCw size={12} /> Rodar de novo
      </Link>
      <Link
        to={`/projects/${projectId}/search?from=${item.id}`}
        title="Abrir o construtor de busca com esta query"
        className="history-link"
      >
        <Pencil size={12} /> Nova busca a partir desta
      </Link>
    </>
  ) : null;

export const UndoButton: React.FC<{ item: SearchHistoryItem; onRevertSearch: (searchId: number) => void }> = (
  props,
) => {
  const { confirm } = useDialogs();
  const texts = undoTexts(props.item);
  const ask = async () => {
    const message = texts.confirm;
    if (await confirm({ title: texts.label, message, confirmLabel: texts.label, danger: true })) {
      props.onRevertSearch(props.item.id);
    }
  };
  return (
    <button onClick={() => void ask()} title={texts.title} className="history-undo">
      <RotateCcw size={12} /> {texts.label}
    </button>
  );
};

const EntryMeta: React.FC<{ item: SearchHistoryItem }> = ({ item }) => {
  const limitText = historyLimitText(item);
  return (
    <div className="history-entry-meta">
      <span className="history-entry-id">ID: #{item.id}</span>
      <Calendar size={14} /> {new Date(item.created_at).toLocaleString()}
      {item.sort_by && (
        <>
          <span className="history-entry-separator">|</span>
          <span>
            Ordenação: <strong>{sortLabel(item.sort_by)}</strong>
          </span>
        </>
      )}
      {limitText && (
        <>
          <span className="history-entry-separator">|</span>
          <span>
            Limite: <strong>{limitText}</strong>
          </span>
        </>
      )}
    </div>
  );
};

const EntryTop: React.FC<HistoryEntryProps> = ({ item, onRevertSearch, projectId }) => (
  <div className="history-entry-top">
    <EntryMeta item={item} />
    <div className="history-entry-actions">
      {projectId !== undefined && <SearchFromLinks projectId={projectId} item={item} />}
      {onRevertSearch && <UndoButton item={item} onRevertSearch={onRevertSearch} />}
      <div className="history-entry-total">{item.total_results} artigos salvos</div>
    </div>
  </div>
);

const TranslatedQueries: React.FC<{ item: SearchHistoryItem }> = ({ item }) => (
  <div>
    <div className="history-entry-label history-entry-label--small">
      <ChevronRight size={14} /> Queries Traduzidas
    </div>
    <details className="history-translations">
      <summary>Ver detalhes da tradução</summary>
      <div className="history-translations-list">
        {Object.entries(parseStoredObject<Record<string, string>>(item.translated_queries)).map(([db, q]) => (
          <div key={db} className="history-translation">
            <strong>{databaseLabel(db)}:</strong> {q}
          </div>
        ))}
      </div>
    </details>
  </div>
);

/**
 * One search of the project history: when it ran and how, its actions (run again, start from it, undo), monitoring,
 * the unified query, each base's outcome and the translated queries.
 *
 * @example <HistoryEntry item={entry} projectId={4} onRevertSearch={revert} onMonitorChange={(d) => set(entry.id, d)} />
 */
export const HistoryEntry: React.FC<HistoryEntryProps> = (props) => {
  const { item, projectId } = props;
  return (
    <div className="history-entry">
      <EntryTop {...props} />
      {isMonitorResult(item) && <div className="history-entry-monitor-result">Resultado do monitoramento</div>}
      {projectId !== undefined && (
        <div className="history-entry-monitor">
          <SearchMonitorControl item={item} monitor={props.monitor} onChange={props.onMonitorChange} />
        </div>
      )}
      <div className="history-entry-query">
        <div className="history-entry-label">
          <Search size={16} /> Query Unificada
        </div>
        <div className="history-entry-unified">{item.unified_query}</div>
      </div>
      <div className="history-entry-columns">
        <HistoryBreakdown
          breakdown={parseStoredObject<SearchBreakdown>(item.results_breakdown)}
          saved={item.total_results}
          uniqueResults={item.unique_results}
        />
        <TranslatedQueries item={item} />
      </div>
    </div>
  );
};

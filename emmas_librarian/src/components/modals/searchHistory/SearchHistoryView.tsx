import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import type { SearchBreakdown, SearchHistoryItem, SearchMonitor } from '../../../types';
import { isMonitorResult } from '../../../utils/searchMonitor';
import { databaseLabel } from '../searchSummary/SearchBreakdownList';
import { HistoryBreakdown } from './HistoryBreakdown';
import { SearchFromLinks, UndoButton } from './HistoryEntry';
import { SearchMonitorControl, useSearchMonitors } from './SearchMonitorControl';
import { historyLimitText, parseStoredObject, sortLabel } from './historyDetails';
import { historyBasesLine, historyEntryTitle, historyWhen } from './historyListItem';
import './historyView.css';

interface SearchHistoryViewProps {
  history: SearchHistoryItem[];
  projectId: number;
  onRevertSearch: (searchId: number) => void;
}

const isWatched = (monitor?: SearchMonitor) => Boolean(monitor?.interval_days);

const ListItem: React.FC<{ item: SearchHistoryItem; selected: boolean; watched: boolean; onSelect: () => void }> = (
  props,
) => (
  <button
    type="button"
    className={`history-item${props.selected ? ' is-on' : ''}`}
    aria-current={props.selected || undefined}
    onClick={props.onSelect}
  >
    <span className="history-item__top">
      <span className="history-item__title">{historyEntryTitle(props.item)}</span>
      {props.watched && (
        <span className="history-badge">
          <Bell size={12} aria-hidden="true" /> Monitorada
        </span>
      )}
      <span className="history-item__when">{historyWhen(props.item.created_at)}</span>
    </span>
    <span className="history-item__query">{props.item.unified_query}</span>
    <span className="history-item__foot">
      <span>{historyBasesLine(props.item)}</span>
      <span className="history-item__saved">
        {props.item.total_results} {props.item.total_results === 1 ? 'salvo' : 'salvos'}
      </span>
    </span>
  </button>
);

const detailMeta = (item: SearchHistoryItem): string =>
  [
    new Date(item.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    item.sort_by && `ordenada por ${sortLabel(item.sort_by).toLowerCase()}`,
    historyLimitText(item) && `até ${historyLimitText(item)}`,
  ]
    .filter(Boolean)
    .join(' · ');

const BaseQueries: React.FC<{ item: SearchHistoryItem }> = ({ item }) => {
  const queries = Object.entries(parseStoredObject<Record<string, string>>(item.translated_queries));
  if (queries.length === 0) return null;
  return (
    <section className="history-detail__block" aria-label="Como cada base recebeu">
      <span className="history-label">Como cada base recebeu</span>
      {queries.map(([db, query]) => (
        <div key={db} className="history-base-query">
          <span className="history-base-query__name">{databaseLabel(db)}</span>
          <code className="history-code">{query}</code>
        </div>
      ))}
    </section>
  );
};

interface DetailProps {
  item: SearchHistoryItem;
  projectId: number;
  monitor?: SearchMonitor;
  onMonitorChange: (days: Parameters<React.ComponentProps<typeof SearchMonitorControl>['onChange']>[0]) => void;
  onRevertSearch: (searchId: number) => void;
}

const Detail: React.FC<DetailProps> = ({ item, projectId, monitor, onMonitorChange, onRevertSearch }) => (
  <article className="history-detail" aria-label={historyEntryTitle(item)}>
    <header className="history-detail__head">
      <div>
        <h2 className="history-detail__title">{historyEntryTitle(item)}</h2>
        <span className="history-detail__meta">{detailMeta(item)}</span>
      </div>
      <div className="history-detail__actions">
        <SearchFromLinks projectId={projectId} item={item} />
        <UndoButton item={item} onRevertSearch={onRevertSearch} />
      </div>
    </header>
    {isMonitorResult(item) && <p className="history-detail__note">Resultado do monitoramento</p>}
    <SearchMonitorControl item={item} monitor={monitor} onChange={onMonitorChange} />
    <section className="history-detail__block" aria-label="Query unificada">
      <span className="history-label">Query unificada</span>
      <code className="history-code history-code--block">{item.unified_query}</code>
    </section>
    <div className="history-detail__columns">
      <HistoryBreakdown
        breakdown={parseStoredObject<SearchBreakdown>(item.results_breakdown)}
        saved={item.total_results}
        uniqueResults={item.unique_results}
      />
      <BaseQueries item={item} />
    </div>
  </article>
);

/**
 * The project's search history (board 157): every search and inclusion on the left, newest first, with its bases,
 * how many it saved and whether it is watched; the chosen one on the right, with what it asked each base, what came
 * back, and the actions (run again, start from it, undo, watch).
 *
 * @example <SearchHistoryView history={history} projectId={4} onRevertSearch={revert} />
 */
export const SearchHistoryView: React.FC<SearchHistoryViewProps> = ({ history, projectId, onRevertSearch }) => {
  const monitoring = useSearchMonitors(projectId);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  if (history.length === 0) return <p className="history-empty">Nenhuma busca registrada ainda.</p>;
  const selected = history.find((h) => h.id === selectedId) ?? history[0];
  const monitorOf = (id: number) => monitoring.monitors.find((m) => m.search_id === id);
  return (
    <div className="history-view">
      {monitoring.error && (
        <div role="alert" className="history-monitor-error">
          {monitoring.error}
        </div>
      )}
      <nav className="history-list-panel" aria-label="Buscas do projeto">
        {history.map((item) => (
          <ListItem
            key={item.id}
            item={item}
            selected={item.id === selected.id}
            watched={isWatched(monitorOf(item.id))}
            onSelect={() => setSelectedId(item.id)}
          />
        ))}
      </nav>
      <Detail
        item={selected}
        projectId={projectId}
        monitor={monitorOf(selected.id)}
        onMonitorChange={(days) => void monitoring.set(selected.id, days)}
        onRevertSearch={onRevertSearch}
      />
    </div>
  );
};

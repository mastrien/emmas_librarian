import React, { useEffect, useState } from 'react';
import { useProjectService } from '../../../contexts/ServicesContext';
import type { SearchHistoryItem, SearchMonitor } from '../../../types';
import { describeError } from '../../../utils/describeError';
import {
  isMonitorResult,
  MONITOR_INTERVAL_NAMES,
  MONITOR_INTERVALS,
  type MonitorInterval,
} from '../../../utils/searchMonitor';
import { restoreSearch } from '../../../pages/Search/searchQueries';
import { ExperimentalTag } from '../../../components/common/ExperimentalTag';
import './searchHistory.css';

/** Said wherever monitoring shows (release 1.3.0): it was only seen without new results so far. */
export const MONITOR_EXPERIMENTAL_REASON =
  'O monitoramento ainda não foi visto encontrando um artigo novo de verdade: até agora, só verificações sem novidades.';

/**
 * The project's monitored searches, read once and changed as the person marks them.
 *
 * @example const monitors = useSearchMonitors(3);
 */
export function useSearchMonitors(projectId: number | undefined) {
  const service = useProjectService();
  const [monitors, setMonitors] = useState<SearchMonitor[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (projectId === undefined) return;
    let alive = true;
    service
      .getSearchMonitors(projectId)
      .then((rows) => alive && setMonitors(rows ?? []))
      .catch((err: unknown) => alive && setError(describeError(err)));
    return () => {
      alive = false;
    };
  }, [service, projectId]);
  const set = async (searchId: number, intervalDays: MonitorInterval | null) => {
    if (projectId === undefined) return;
    setError(null);
    try {
      setMonitors(await service.setSearchMonitor(projectId, searchId, intervalDays));
    } catch (err) {
      setError(describeError(err));
    }
  };
  return { monitors, error, set };
}

const DEFAULT_INTERVAL: MonitorInterval = 7;

const basesOf = (item: SearchHistoryItem): string => {
  try {
    return Object.keys(JSON.parse(item.results_breakdown || '{}') as object).join(', ');
  } catch {
    return '';
  }
};

const lastCheckText = (checkedAt: string | null): string =>
  checkedAt
    ? `Última verificação em ${new Date(checkedAt).toLocaleDateString()}`
    : 'Primeira verificação na próxima abertura do app';

/**
 * "Monitorar esta busca", on a search of the history (#52). The person marks it and picks the interval, and the line
 * says what a check spends. Not offered where there is no query to run, or on what monitoring itself saved.
 *
 * @example <SearchMonitorControl item={entry} monitor={monitor} onChange={(days) => set(entry.id, days)} />
 */
export const SearchMonitorControl: React.FC<{
  item: SearchHistoryItem;
  monitor?: SearchMonitor;
  onChange: (intervalDays: MonitorInterval | null) => void;
}> = ({ item, monitor, onChange }) => {
  if (!restoreSearch(item) || isMonitorResult(item)) return null;
  return (
    <div className="custom-controls history-monitor">
      <label>
        <input
          type="checkbox"
          checked={!!monitor}
          onChange={(e) => onChange(e.target.checked ? DEFAULT_INTERVAL : null)}
        />
        Monitorar esta busca
      </label>
      <ExperimentalTag reason={MONITOR_EXPERIMENTAL_REASON} />
      {monitor && (
        <>
          <select
            className="input-field input-compact"
            aria-label="Intervalo da verificação"
            value={monitor.interval_days}
            onChange={(e) => onChange(Number(e.target.value) as MonitorInterval)}
          >
            {MONITOR_INTERVALS.map((days) => (
              <option key={days} value={days}>
                {MONITOR_INTERVAL_NAMES[days]}
              </option>
            ))}
          </select>
          <span className="history-monitor-muted">{lastCheckText(monitor.last_checked_at)}</span>
          <span className="history-monitor-muted history-monitor-cost">
            Cada verificação roda esta busca em {basesOf(item)} e gasta a cota das suas chaves: ao menos uma requisição
            por base. Só acontece com o app aberto.
          </span>
        </>
      )}
    </div>
  );
};

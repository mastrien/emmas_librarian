import React from 'react';
import type { SearchBaseOutcome, SearchBreakdown } from '../../../types';
import { baseCountText, databaseLabel } from '../searchSummary/SearchBreakdownList';
import { requestsText } from './historyDetails';
import './searchHistory.css';

const toneOf = (outcome: SearchBaseOutcome): string => (outcome.error ? 'error' : outcome.warning ? 'warning' : 'ok');

/**
 * How many results were saved that did not come from a single new record: the bases returned more than the project
 * kept, because some were already in it or came from more than one base.
 *
 * @example overlapNote({ openalex: { count: 20 }, scopus: { count: 20 } }, 30) // "10 já estavam no projeto ou vieram de mais de uma base."
 */
export function overlapNote(breakdown: SearchBreakdown, saved: number): string | null {
  const returned = Object.values(breakdown).reduce((sum, outcome) => sum + (outcome.error ? 0 : outcome.count), 0);
  const left = returned - saved;
  return left > 0 ? `${left} já estavam no projeto ou vieram de mais de uma base.` : null;
}

/**
 * A history entry's per-base outcome (board 157): a table with what each base returned and, last, how many were
 * saved in the project; why a base failed or stopped early and the requests each base cost stay under it.
 *
 * Usage:
 *   <HistoryBreakdown breakdown={parseStoredObject(item.results_breakdown)} saved={item.total_results} />
 */
export const HistoryBreakdown: React.FC<{
  breakdown: SearchBreakdown;
  saved: number;
  uniqueResults?: number | null;
}> = ({ breakdown, saved, uniqueResults }) => {
  const entries = Object.entries(breakdown);
  const notes = entries.filter(([, o]) => o.error || o.warning);
  const requests = requestsText(breakdown);
  const overlap = overlapNote(breakdown, saved);
  return (
    <section aria-label="Resultados por base desta busca" className="history-detail__block">
      <span className="history-label">Resultados por base</span>
      <table className="history-breakdown-table">
        <thead>
          <tr>
            <th>Base</th>
            <th className="history-breakdown-table__num">Retornados</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([db, outcome]) => (
            <tr key={db}>
              <td>{databaseLabel(db)}</td>
              <td className={`history-breakdown-table__num history-breakdown-table__num--${toneOf(outcome)}`}>
                {baseCountText(outcome)}
              </td>
            </tr>
          ))}
          <tr className="history-breakdown-table__total">
            <td>Salvos no projeto</td>
            <td className="history-breakdown-table__num">{saved.toLocaleString('pt-BR')}</td>
          </tr>
        </tbody>
      </table>
      {overlap && <p className="history-breakdown-muted">{overlap}</p>}
      {notes.map(([db, outcome]) => (
        <p key={db} className={`history-breakdown-note history-breakdown-note--${toneOf(outcome)}`}>
          {databaseLabel(db)}: {outcome.error ?? outcome.warning}
        </p>
      ))}
      {typeof uniqueResults === 'number' && (
        <p className="history-breakdown-muted">Únicos entre as bases: {uniqueResults.toLocaleString('pt-BR')}</p>
      )}
      {requests && <p className="history-breakdown-muted">Requisições: {requests}</p>}
    </section>
  );
};

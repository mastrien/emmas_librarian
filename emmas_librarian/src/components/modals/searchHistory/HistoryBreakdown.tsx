import React from 'react';
import { Database } from 'lucide-react';
import type { SearchBaseOutcome, SearchBreakdown } from '../../../types';
import { baseCountText, databaseLabel } from '../searchSummary/SearchBreakdownList';
import { requestsText } from './historyDetails';
import './searchHistory.css';

const toneOf = (outcome: SearchBaseOutcome): string => (outcome.error ? 'error' : outcome.warning ? 'warning' : 'ok');

/**
 * A history entry's per-base outcome, kept for traceability: what each base returned (and how many it had),
 * why a base failed or stopped early, the distinct results across bases and the requests each base cost.
 *
 * Usage:
 *   <HistoryBreakdown breakdown={parseStoredObject(item.results_breakdown)} uniqueResults={item.unique_results} />
 */
export const HistoryBreakdown: React.FC<{ breakdown: SearchBreakdown; uniqueResults?: number | null }> = ({
  breakdown,
  uniqueResults,
}) => {
  const entries = Object.entries(breakdown);
  const notes = entries.filter(([, o]) => o.error || o.warning);
  const requests = requestsText(breakdown);
  return (
    <section aria-label="Resultados por base desta busca">
      <div className="history-entry-label history-entry-label--small">
        <Database size={14} /> Resultados por Base
      </div>
      <div className="history-breakdown-chips">
        {entries.map(([db, outcome]) => (
          <div key={db} className={`history-breakdown-chip history-breakdown-chip--${toneOf(outcome)}`}>
            {databaseLabel(db)}: <strong>{baseCountText(outcome)}</strong>
          </div>
        ))}
      </div>
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

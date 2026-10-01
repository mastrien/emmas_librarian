import React from 'react';
import { Database } from 'lucide-react';
import type { SearchBaseOutcome, SearchBreakdown } from '../../../types';
import { baseCountText, databaseLabel } from '../searchSummary/SearchBreakdownList';
import { requestsText } from './historyDetails';

const toneColor = (outcome: SearchBaseOutcome): string =>
  outcome.error ? 'var(--color-danger)' : outcome.warning ? 'var(--color-warning)' : 'var(--border-color)';

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
      <div style={headingStyle}>
        <Database size={14} /> Resultados por Base
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {entries.map(([db, outcome]) => (
          <div key={db} style={{ ...chipStyle, border: `1px solid ${toneColor(outcome)}` }}>
            {databaseLabel(db)}: <strong>{baseCountText(outcome)}</strong>
          </div>
        ))}
      </div>
      {notes.map(([db, outcome]) => (
        <p key={db} style={{ ...noteStyle, color: outcome.error ? 'var(--color-danger)' : 'var(--color-warning)' }}>
          {databaseLabel(db)}: {outcome.error ?? outcome.warning}
        </p>
      ))}
      {typeof uniqueResults === 'number' && (
        <p style={mutedStyle}>Únicos entre as bases: {uniqueResults.toLocaleString('pt-BR')}</p>
      )}
      {requests && <p style={mutedStyle}>Requisições: {requests}</p>}
    </section>
  );
};

const headingStyle: React.CSSProperties = {
  fontWeight: 600,
  color: 'var(--text-heading)',
  marginBottom: '0.75rem',
  fontSize: '0.9rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
};
const chipStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  padding: '0.3rem 0.6rem',
  background: 'var(--bg-surface)',
  borderRadius: 'var(--radius-sm)',
};
const noteStyle: React.CSSProperties = { fontSize: '0.75rem', fontStyle: 'italic', margin: '0.5rem 0 0' };
const mutedStyle: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' };

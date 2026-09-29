import React from 'react';
import { Database } from 'lucide-react';
import type { SearchBaseOutcome, SearchBreakdown } from '../../../types';
import { SEARCH_DATABASES } from '../../../pages/Search/searchQueries';

// Official names ("OpenAlex", not the capitalized id "Openalex").
export const databaseLabel = (db: string): string => SEARCH_DATABASES.find((d) => d.id === db)?.label ?? db;

const count = (n: number) => n.toLocaleString('pt-BR');

type Tone = 'ok' | 'warning' | 'error';

const toneOf = (outcome: SearchBaseOutcome): Tone => (outcome.error ? 'error' : outcome.warning ? 'warning' : 'ok');

const TONE_COLOR: Record<Tone, string> = {
  ok: 'var(--text-heading)',
  warning: 'var(--color-warning)',
  error: 'var(--color-danger)',
};

/**
 * The count shown for a base: "Falha", or what arrived, with how many the base had when it said more.
 *
 * Usage:
 *   baseCountText({ count: 1000, available: 5321 }); // "1.000 de 5.321 na base"
 */
export function baseCountText(outcome: SearchBaseOutcome): string {
  if (outcome.error) return 'Falha';
  if (outcome.available !== undefined && outcome.available > outcome.count) {
    return `${count(outcome.count)} de ${count(outcome.available)} na base`;
  }
  return count(outcome.count);
}

/**
 * How many results each database returned, why it failed, or why it stopped early (it keeps what arrived).
 *
 * @example <SearchBreakdownList breakdown={{ openalex: { count: 3 }, crossref: { count: 0, error: 'HTTP 503' } }} />
 */
export const SearchBreakdownList: React.FC<{ breakdown: SearchBreakdown }> = ({ breakdown }) => (
  <section aria-label="Resultados por base" style={{ marginBottom: '1.5rem' }}>
    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <Database size={18} /> Resultados por Base
    </h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {Object.entries(breakdown).map(([db, outcome]) => (
        <BaseOutcomeRow key={db} db={db} outcome={outcome} />
      ))}
    </div>
  </section>
);

const BaseOutcomeRow: React.FC<{ db: string; outcome: SearchBaseOutcome }> = ({ db, outcome }) => {
  const tone = toneOf(outcome);
  const note = outcome.error ?? outcome.warning;
  return (
    <div
      style={{
        padding: '0.8rem 1rem',
        background: 'var(--bg-main)',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${tone === 'ok' ? 'var(--border-color)' : TONE_COLOR[tone]}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontWeight: 600 }}>{databaseLabel(db)}</span>
        <span style={{ fontWeight: 700, color: TONE_COLOR[tone], fontVariantNumeric: 'tabular-nums' }}>
          {baseCountText(outcome)}
        </span>
      </div>
      {note && (
        <div style={{ fontSize: '0.75rem', color: TONE_COLOR[tone], marginTop: '0.25rem', fontStyle: 'italic' }}>
          {note}
        </div>
      )}
    </div>
  );
};

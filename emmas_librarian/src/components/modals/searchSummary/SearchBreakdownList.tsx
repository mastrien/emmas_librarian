import React from 'react';
import { Database } from 'lucide-react';
import type { SearchBaseOutcome, SearchBreakdown } from '../../../types';
import { SEARCH_DATABASES } from '../../../pages/Search/searchQueries';
import './searchSummary.css';

// Official names ("OpenAlex", not the capitalized id "Openalex").
export const databaseLabel = (db: string): string => SEARCH_DATABASES.find((d) => d.id === db)?.label ?? db;

const count = (n: number) => n.toLocaleString('pt-BR');

type Tone = 'ok' | 'warning' | 'error';

const toneOf = (outcome: SearchBaseOutcome): Tone => (outcome.error ? 'error' : outcome.warning ? 'warning' : 'ok');

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
  <section aria-label="Resultados por base">
    <h3 className="search-summary-section-title">
      <Database size={18} /> Resultados por Base
    </h3>
    <div className="search-breakdown-rows">
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
    <div className={`search-breakdown-row search-breakdown-row--${tone}`}>
      <div className="search-breakdown-line">
        <span className="search-breakdown-name">{databaseLabel(db)}</span>
        <span className="search-breakdown-count">{baseCountText(outcome)}</span>
      </div>
      {note && <div className="search-breakdown-note">{note}</div>}
    </div>
  );
};

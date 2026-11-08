import React, { useId, useState } from 'react';
import {
  effectiveLimit,
  isSearchBase,
  limitProblems,
  searchCost,
  SEARCH_LIMITS,
  type SearchBaseId,
  type SearchLimitProblem,
  type SearchLimits,
} from '../../utils/searchLimits';
import { SEARCH_DATABASES } from './searchQueries';
import './search.css';

interface SearchLimitsFieldProps {
  limits: SearchLimits;
  /** The chosen bases, by id. */
  selected: string[];
  onChange: (limits: SearchLimits) => void;
}

const label = (base: SearchBaseId) => SEARCH_DATABASES.find((d) => d.id === base)?.label ?? base;
const count = (n: number) => n.toLocaleString('pt-BR');

function costText(base: SearchBaseId, limit: number): string {
  const { requests, seconds } = searchCost(base, limit);
  const wait = seconds > 0 ? ` · ~${seconds} s` : '';
  return `máx. ${count(SEARCH_LIMITS[base].max)} · ${requests} ${requests === 1 ? 'requisição' : 'requisições'}${wait}`;
}

// The search is blocked while any of these shows, so it never runs differently from what the page says.
function problemText(p: SearchLimitProblem): string {
  const name = label(p.base);
  if (!Number.isInteger(p.value) || p.value < 1) return `Use um número inteiro a partir de 1 para ${name}.`;
  if (p.fromCommon) {
    return `${name} aceita até ${count(p.max)} resultados. Diminua o valor comum ou ajuste ${name} em "Ajustar por base".`;
  }
  return `${name} aceita até ${count(p.max)} resultados (você pediu ${count(p.value)}).`;
}

const parse = (raw: string): number => (raw.trim() === '' ? NaN : Number(raw));

/**
 * The results limit of a search: one common value for every chosen base, a line with what each base will
 * use, and "Ajustar por base" to set a base apart (an empty field follows the common value). Values above
 * a base's ceiling are listed as problems; the page blocks the search while there are any.
 *
 * Usage:
 *   <SearchLimitsField limits={limits} selected={['openalex', 'wos']} onChange={setLimits} />
 */
export const SearchLimitsField: React.FC<SearchLimitsFieldProps> = ({ limits, selected, onChange }) => {
  const commonId = useId();
  const bases = selected.filter(isSearchBase);
  const problems = limitProblems(limits, bases);
  const [adjusting, setAdjusting] = useState(Object.keys(limits.perBase).length > 0);

  const setBase = (base: SearchBaseId, raw: string) => {
    const perBase = { ...limits.perBase };
    if (raw.trim() === '') delete perBase[base];
    else perBase[base] = parse(raw);
    onChange({ ...limits, perBase });
  };

  return (
    <div>
      <label htmlFor={commonId} className="search-section-label search-section-label--field">
        Máximo de resultados por base
      </label>
      <input
        id={commonId}
        type="number"
        min="1"
        value={Number.isNaN(limits.common) ? '' : limits.common}
        onChange={(e) => onChange({ ...limits, common: parse(e.target.value) })}
        className="search-control"
      />
      {bases.length > 0 && (
        <p className="search-note" aria-label="Resultados pedidos a cada base">
          {bases.map((base) => `${label(base)} ${count(effectiveLimit(limits, base))}`).join(' · ')}
        </p>
      )}
      <details open={adjusting} onToggle={(e) => setAdjusting(e.currentTarget.open)} className="search-limits-adjust">
        <summary>Ajustar por base</summary>
        <div className="search-limits-rows">
          {bases.map((base) => (
            <BaseRow key={base} base={base} limits={limits} onChange={(raw) => setBase(base, raw)} />
          ))}
        </div>
      </details>
      {problems.length > 0 && (
        <ul role="alert" className="search-limits-problems">
          {problems.map((p) => (
            <li key={p.base}>{problemText(p)}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface BaseRowProps {
  base: SearchBaseId;
  limits: SearchLimits;
  onChange: (raw: string) => void;
}

const BaseRow: React.FC<BaseRowProps> = ({ base, limits, onChange }) => {
  const id = useId();
  const own = limits.perBase[base];
  return (
    <div className="search-limits-row">
      <label htmlFor={id}>{label(base)}</label>
      <input
        id={id}
        type="number"
        min="1"
        value={own === undefined || Number.isNaN(own) ? '' : own}
        placeholder={`${limits.common} (comum)`}
        onChange={(e) => onChange(e.target.value)}
        className="search-control search-control--small"
      />
      <span className="search-limits-cost">{costText(base, effectiveLimit(limits, base))}</span>
    </div>
  );
};

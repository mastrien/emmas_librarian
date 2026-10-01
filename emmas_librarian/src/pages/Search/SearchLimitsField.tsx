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

interface SearchLimitsFieldProps {
  limits: SearchLimits;
  /** The chosen bases, by id. */
  selected: string[];
  onChange: (limits: SearchLimits) => void;
  /** Shared look of the page's inputs. */
  inputStyle: React.CSSProperties;
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
 *   <SearchLimitsField limits={limits} selected={['openalex', 'wos']} onChange={setLimits} inputStyle={controlStyle} />
 */
export const SearchLimitsField: React.FC<SearchLimitsFieldProps> = ({ limits, selected, onChange, inputStyle }) => {
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
      <label htmlFor={commonId} style={headingStyle}>
        Máximo de resultados por base
      </label>
      <input
        id={commonId}
        type="number"
        min="1"
        value={Number.isNaN(limits.common) ? '' : limits.common}
        onChange={(e) => onChange({ ...limits, common: parse(e.target.value) })}
        style={inputStyle}
      />
      {bases.length > 0 && (
        <p style={noteStyle} aria-label="Resultados pedidos a cada base">
          {bases.map((base) => `${label(base)} ${count(effectiveLimit(limits, base))}`).join(' · ')}
        </p>
      )}
      <details open={adjusting} onToggle={(e) => setAdjusting(e.currentTarget.open)} style={{ marginTop: '0.5rem' }}>
        <summary style={summaryStyle}>Ajustar por base</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
          {bases.map((base) => (
            <BaseRow
              key={base}
              base={base}
              limits={limits}
              onChange={(raw) => setBase(base, raw)}
              inputStyle={inputStyle}
            />
          ))}
        </div>
      </details>
      {problems.length > 0 && (
        <ul role="alert" style={problemListStyle}>
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
  inputStyle: React.CSSProperties;
}

const BaseRow: React.FC<BaseRowProps> = ({ base, limits, onChange, inputStyle }) => {
  const id = useId();
  const own = limits.perBase[base];
  return (
    <div style={rowStyle}>
      <label htmlFor={id} style={{ fontWeight: 600 }}>
        {label(base)}
      </label>
      <input
        id={id}
        type="number"
        min="1"
        value={own === undefined || Number.isNaN(own) ? '' : own}
        placeholder={`${limits.common} (comum)`}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, padding: '0.5rem 0.7rem' }}
      />
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {costText(base, effectiveLimit(limits, base))}
      </span>
    </div>
  );
};

const headingStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.5rem',
  fontWeight: 600,
  color: 'var(--text-heading)',
  fontSize: '1.1rem',
};
const noteStyle: React.CSSProperties = { margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' };
const summaryStyle: React.CSSProperties = { cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600 };
const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '8.5rem 10rem 1fr',
  gap: '0.75rem',
  alignItems: 'center',
};
const problemListStyle: React.CSSProperties = {
  margin: '0.75rem 0 0',
  paddingLeft: '1.1rem',
  color: 'var(--color-danger)',
  fontSize: '0.85rem',
  fontWeight: 600,
};

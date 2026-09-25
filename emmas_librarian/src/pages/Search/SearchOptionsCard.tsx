import React from 'react';
import type { QuerySort } from '../../types';

interface SearchOptionsCardProps {
  sortBy: QuerySort;
  limit: number;
  selected: string[];
  onSortByChange: (sortBy: QuerySort) => void;
  onLimitChange: (limit: number) => void;
}

const DEFAULT_LIMIT = 50;
const CROSSREF_MAX = 1000;
const SCOPUS_MAX = 5000;
// Lower Scopus subscription tiers reject requests above this with "Exceeds maximum".
const SCOPUS_SAFE_LIMIT = 200;

const headingStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.5rem',
  fontWeight: 600,
  color: 'var(--text-heading)',
  fontSize: '1.1rem',
};

const controlStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.8rem 1rem',
  fontSize: '1rem',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-main)',
  color: 'var(--text-main)',
  outline: 'none',
  transition: 'border-color var(--transition-fast)',
};

const focusHighlight = {
  onFocus: (e: React.FocusEvent<HTMLElement>) => (e.currentTarget.style.borderColor = 'var(--color-primary)'),
  onBlur: (e: React.FocusEvent<HTMLElement>) => (e.currentTarget.style.borderColor = 'var(--border-color)'),
};

/**
 * Sort order and per-base result limit, with the known API caps for the selected bases.
 *
 * Usage:
 *   <SearchOptionsCard sortBy="relevance" limit={50} selected={['crossref']} onSortByChange={setSort} onLimitChange={setLimit} />
 */
export const SearchOptionsCard: React.FC<SearchOptionsCardProps> = ({
  sortBy,
  limit,
  selected,
  onSortByChange,
  onLimitChange,
}) => (
  <div className="card" style={{ padding: '2rem' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      <div>
        <label style={headingStyle}>Critério de Ordenação</label>
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as QuerySort)}
          style={controlStyle}
          {...focusHighlight}
        >
          <option value="relevance">Mais Relevantes (Padrão)</option>
          <option value="citations">Mais Citados (Maior Impacto)</option>
          <option value="date">Mais Recentes</option>
        </select>
      </div>
      <div>
        <label style={headingStyle}>Quantidade Máxima (por base)</label>
        <input
          type="number"
          value={limit}
          onChange={(e) => onLimitChange(parseInt(e.target.value) || DEFAULT_LIMIT)}
          min="10"
          max="100000"
          style={controlStyle}
          {...focusHighlight}
        />
        <ApiLimitNotes limit={limit} selected={selected} />
      </div>
    </div>
  </div>
);

const danger = (condition: boolean): React.CSSProperties => ({ color: condition ? 'var(--color-danger)' : 'inherit' });

const ApiLimitNotes: React.FC<{ limit: number; selected: string[] }> = ({ limit, selected }) => {
  const crossref = selected.includes('crossref');
  const scopus = selected.includes('scopus');
  return (
    <div
      style={{
        marginTop: '0.75rem',
        fontSize: '0.85rem',
        color: 'var(--text-muted)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
      }}
    >
      <strong>Limites das APIs:</strong>
      <span style={danger(crossref && limit > CROSSREF_MAX)}>• Crossref: máximo de 1.000 resultados.</span>
      <span style={danger(scopus && limit > SCOPUS_MAX)}>
        • Scopus: a API pode limitar entre 200 e 5.000 dependendo da assinatura institucional (pode falhar em limites
        altos).
      </span>
      <span>• OpenAlex / Web of Science: máximo de 100.000 resultados.</span>
      {crossref && limit > CROSSREF_MAX && (
        <span style={{ color: 'var(--color-danger)', fontWeight: 600, marginTop: '0.25rem' }}>
          Atenção: A base Crossref será limitada a 1.000 resultados.
        </span>
      )}
      {scopus && limit > SCOPUS_SAFE_LIMIT && (
        <span style={{ color: 'var(--color-warning)', fontWeight: 600, marginTop: '0.25rem' }}>
          Aviso: A base Scopus pode retornar erro (Exceeds maximum) para limites &gt; 200 dependendo do seu nível de
          serviço.
        </span>
      )}
    </div>
  );
};

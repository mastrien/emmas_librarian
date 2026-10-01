import React from 'react';
import type { QuerySort } from '../../types';
import type { SearchLimits } from '../../utils/searchLimits';
import { SearchLimitsField } from './SearchLimitsField';

interface SearchOptionsCardProps {
  sortBy: QuerySort;
  limits: SearchLimits;
  selected: string[];
  onSortByChange: (sortBy: QuerySort) => void;
  onLimitsChange: (limits: SearchLimits) => void;
}

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
 * Sort order and how many results to ask of each base (a common value with per-base adjustments).
 *
 * Usage:
 *   <SearchOptionsCard sortBy="relevance" limits={limits} selected={['crossref']} onSortByChange={setSort} onLimitsChange={setLimits} />
 */
export const SearchOptionsCard: React.FC<SearchOptionsCardProps> = ({
  sortBy,
  limits,
  selected,
  onSortByChange,
  onLimitsChange,
}) => (
  <div className="card" style={{ padding: '2rem' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '2rem' }}>
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
      <SearchLimitsField limits={limits} selected={selected} onChange={onLimitsChange} inputStyle={controlStyle} />
    </div>
  </div>
);

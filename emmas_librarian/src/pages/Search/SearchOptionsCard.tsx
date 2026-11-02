import React from 'react';
import type { QuerySort } from '../../types';
import type { SearchLimits } from '../../utils/searchLimits';
import { publishedSinceNote } from '../../utils/publishedSince';
import { SearchLimitsField } from './SearchLimitsField';

interface SearchOptionsCardProps {
  sortBy: QuerySort;
  limits: SearchLimits;
  selected: string[];
  onSortByChange: (sortBy: QuerySort) => void;
  onLimitsChange: (limits: SearchLimits) => void;
  /** Only works published on or after this date (YYYY-MM-DD); empty for no filter. */
  publishedSince: string;
  onPublishedSinceChange: (date: string) => void;
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
  publishedSince,
  onPublishedSinceChange,
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
    <div style={{ marginTop: '1.5rem' }}>
      <label htmlFor="published-since" style={headingStyle}>
        Publicados desde (opcional)
      </label>
      <input
        id="published-since"
        type="date"
        value={publishedSince}
        onChange={(e) => onPublishedSinceChange(e.target.value)}
        style={{ ...controlStyle, width: 'auto' }}
        {...focusHighlight}
      />
      {publishedSince && publishedSinceNote(selected) && (
        <p role="note" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {publishedSinceNote(selected)}
        </p>
      )}
    </div>
  </div>
);

import React from 'react';
import type { QuerySort } from '../../types';
import type { SearchLimits } from '../../utils/searchLimits';
import { publishedSinceNote } from '../../utils/publishedSince';
import { SearchLimitsField } from './SearchLimitsField';
import './search.css';

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
  <div className="search-options-grid">
    <div>
      <label className="search-section-label search-section-label--field">Ordenação</label>
      <select value={sortBy} onChange={(e) => onSortByChange(e.target.value as QuerySort)} className="search-control">
        <option value="relevance">Mais relevantes</option>
        <option value="citations">Mais citados</option>
        <option value="date">Mais recentes</option>
      </select>
    </div>
    <SearchLimitsField limits={limits} selected={selected} onChange={onLimitsChange} />
    <div className="search-published-since">
      <label htmlFor="published-since" className="search-section-label search-section-label--field">
        Publicados desde (opcional)
      </label>
      <input
        id="published-since"
        type="date"
        value={publishedSince}
        onChange={(e) => onPublishedSinceChange(e.target.value)}
        className="search-control search-control--auto"
      />
      {publishedSince && publishedSinceNote(selected) && (
        <p role="note" className="search-note">
          {publishedSinceNote(selected)}
        </p>
      )}
    </div>
  </div>
);

import React from 'react';
import { ArrowUpDown, Search, SlidersHorizontal } from 'lucide-react';
import type { ProjectFiltering } from '../../hooks/useProjectFiltering';
import { activeFilters } from '../../hooks/articleFilters';

const SORT_OPTIONS = [
  ['added-desc', 'Últimos adicionados'],
  ['added-asc', 'Primeiros adicionados'],
  ['year-desc', 'Mais recentes'],
  ['year-asc', 'Mais antigos'],
  ['title-asc', 'Título (A–Z)'],
  ['title-desc', 'Título (Z–A)'],
  ['citations-desc', 'Mais citados'],
  ['citations-asc', 'Menos citados'],
] as const;

interface ArticlesFilterBarProps {
  filtering: ProjectFiltering;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/**
 * "Filtros" (opens the filter panel, with the number of active filters), the search box and the sort
 * order. Every change returns to the first page so the user never lands on an empty page.
 *
 * @example <ArticlesFilterBar filtering={filtering} isSidebarOpen={open} onToggleSidebar={toggle} />
 */
export const ArticlesFilterBar: React.FC<ArticlesFilterBarProps> = ({ filtering, isSidebarOpen, onToggleSidebar }) => {
  const active = activeFilters(filtering.criteria).length;
  const withPageReset =
    <T,>(apply: (value: T) => void) =>
    (value: T) => {
      apply(value);
      filtering.setCurrentPage(1);
    };

  return (
    <div className="filter-bar">
      <button
        type="button"
        className={`btn-ghost${isSidebarOpen || active ? ' is-on' : ''}`}
        onClick={onToggleSidebar}
        aria-expanded={isSidebarOpen}
        aria-controls="article-filters"
        aria-label={active ? `Filtros (${active} ativos)` : 'Filtros'}
      >
        <SlidersHorizontal size={16} /> Filtros
        {active > 0 && <span className="filter-count">{active}</span>}
      </button>
      <div className="filter-bar__search">
        <Search size={16} />
        <input
          type="search"
          value={filtering.searchTerm}
          onChange={(e) => withPageReset(filtering.setSearchTerm)(e.target.value)}
          placeholder="Buscar por título ou autor"
          aria-label="Buscar por título ou autor"
        />
      </div>
      <label className="filter-bar__sort">
        <ArrowUpDown size={15} /> Ordenar
        <select value={filtering.sortOrder} onChange={(e) => withPageReset(filtering.setSortOrder)(e.target.value)}>
          {SORT_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};

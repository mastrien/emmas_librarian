import React, { useEffect, useRef } from 'react';
import { ArrowUpDown, Search } from 'lucide-react';
import type { ProjectFiltering } from '../../hooks/useProjectFiltering';
import { activeFilters, clearedFilters, withoutFilter } from '../../hooks/articleFilters';
import { FiltersPopover } from './FiltersPopover';
import { StatusSegmented } from './StatusSegmented';
import { FilterChips } from './ResultLine';
import './articlesToolbar.css';

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

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * "/" focuses the search from anywhere on the screen, unless the user is already typing somewhere (board 153).
 *
 * @example useSlashFocus(searchRef);
 */
export function useSlashFocus(ref: React.RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ref]);
}

const SearchField: React.FC<{ filtering: ProjectFiltering }> = ({ filtering }) => {
  const ref = useRef<HTMLInputElement>(null);
  useSlashFocus(ref);
  return (
    <div className="articles-search">
      <Search size={16} aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        value={filtering.searchTerm}
        onChange={(e) => {
          filtering.setSearchTerm(e.target.value);
          filtering.setCurrentPage(1);
        }}
        placeholder="Buscar por título ou autor"
        aria-label="Buscar por título ou autor"
        aria-keyshortcuts="/"
      />
      <kbd aria-hidden="true">/</kbd>
    </div>
  );
};

const SortSelect: React.FC<{ filtering: ProjectFiltering }> = ({ filtering }) => (
  <label className="articles-sort">
    <ArrowUpDown size={15} aria-hidden="true" /> Ordenar
    <select
      value={filtering.sortOrder}
      onChange={(e) => {
        filtering.setSortOrder(e.target.value);
        filtering.setCurrentPage(1);
      }}
    >
      {SORT_OPTIONS.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  </label>
);

/**
 * The two lines above the article table (board 153): search ("/") and order; then the status, "Filtros" and the
 * active filters as chips. Every change goes back to the first page.
 *
 * @example <ArticlesToolbar filtering={filtering} />
 */
export const ArticlesToolbar: React.FC<{ filtering: ProjectFiltering }> = ({ filtering }) => {
  const { criteria, applyCriteria, countFor } = filtering;
  return (
    <div className="articles-toolbar">
      <div className="articles-toolbar__row">
        <SearchField filtering={filtering} />
        <SortSelect filtering={filtering} />
      </div>
      <div className="articles-toolbar__row">
        <StatusSegmented
          value={criteria.statusFilter}
          onChange={(statusFilter) => applyCriteria({ ...criteria, statusFilter })}
          countFor={countFor}
        />
        <FiltersPopover filtering={filtering} />
        <FilterChips
          filters={activeFilters(criteria)}
          onRemove={(key) => applyCriteria(withoutFilter(criteria, key))}
          onClear={() => applyCriteria(clearedFilters(criteria))}
        />
      </div>
    </div>
  );
};

import React from 'react';
import { Search } from 'lucide-react';
import { CATEGORY_LABELS, type CategoryFilter, type StatusFilter } from './agendaQueries';

interface AgendaFiltersProps {
  query: string;
  onQueryChange: (query: string) => void;
  category: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  /** Only the deadline list filters by status; the cards show every deadline. */
  status?: StatusFilter;
  onStatusChange?: (status: StatusFilter) => void;
}

/**
 * Search by event, acronym or deadline name, the category, and in the list view the deadline status.
 *
 * @example <AgendaFilters query={q} onQueryChange={setQ} category={c} onCategoryChange={setC} />
 */
export const AgendaFilters: React.FC<AgendaFiltersProps> = (props) => (
  <div className="agenda-filters">
    <div className="agenda-search">
      <Search size={16} aria-hidden="true" />
      <input
        type="text"
        aria-label="Buscar na agenda"
        value={props.query}
        onChange={(e) => props.onQueryChange(e.target.value)}
        placeholder="Buscar por evento ou sigla..."
      />
    </div>
    <select
      className="agenda-select"
      aria-label="Categoria"
      value={props.category}
      onChange={(e) => props.onCategoryChange(e.target.value as CategoryFilter)}
    >
      <option value="all">Todas as Categorias</option>
      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
    {props.status !== undefined && props.onStatusChange && (
      <select
        className="agenda-select"
        aria-label="Status dos prazos"
        value={props.status}
        onChange={(e) => props.onStatusChange?.(e.target.value as StatusFilter)}
      >
        <option value="all">Todos os Status</option>
        <option value="pending">Prazos Pendentes</option>
        <option value="completed">Concluídos</option>
      </select>
    )}
  </div>
);

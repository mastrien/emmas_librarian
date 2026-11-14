import React from 'react';
import { Search } from 'lucide-react';
import { SegmentedControl } from '../SegmentedControl';
import { Switch } from '../Switch';
import { STALE_AFTER_DAYS } from './deadlineDates';
import { CATEGORY_LABELS, type CategoryFilter, type StatusCounts, type StatusFilter } from './agendaQueries';

interface AgendaFiltersProps {
  query: string;
  onQueryChange: (query: string) => void;
  category: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  counts: StatusCounts;
  showStale: boolean;
  onShowStaleChange: (show: boolean) => void;
}

/**
 * The bar of the deadline list (board 173): search, Pendentes / Feitos / Todos with their counts, the category and the
 * switch that shows the deadlines overdue for long.
 *
 * @example <AgendaFilters query={q} onQueryChange={setQ} status={s} onStatusChange={setS} counts={counts} … />
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
        placeholder="Evento ou sigla"
      />
    </div>
    <SegmentedControl<StatusFilter>
      label="Situação dos prazos"
      value={props.status}
      onChange={props.onStatusChange}
      options={[
        { value: 'pending', label: `Pendentes ${props.counts.pending}` },
        { value: 'completed', label: `Feitos ${props.counts.completed}` },
        { value: 'all', label: `Todos ${props.counts.all}` },
      ]}
    />
    <select
      className="agenda-select"
      aria-label="Categoria"
      value={props.category}
      onChange={(e) => props.onCategoryChange(e.target.value as CategoryFilter)}
    >
      <option value="all">Todas as categorias</option>
      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
    <Switch className="agenda-toggle" checked={props.showStale} onChange={props.onShowStaleChange}>
      Mostrar vencidos há mais de {STALE_AFTER_DAYS} dias
    </Switch>
  </div>
);

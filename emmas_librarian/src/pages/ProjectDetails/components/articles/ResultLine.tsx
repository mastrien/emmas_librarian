import React, { useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, SquareCheck, X } from 'lucide-react';
import type { ActiveFilter, FilterKey } from '../../hooks/articleFilters';
import { chipsThatFit } from './chipsThatFit';

const CHIP_GAP = 6.4; // 0.4rem, the gap in .filter-chips

interface FilterChipsProps {
  filters: ActiveFilter[];
  onRemove: (key: FilterKey) => void;
  onShowAll: () => void;
  onClear: () => void;
}

// Measures an invisible copy of the chips and keeps as many as fit on one line; the rest become "+N".
function useVisibleChips(filters: ActiveFilter[]) {
  const lineRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(filters.length);

  useLayoutEffect(() => {
    const line = lineRef.current;
    const measure = measureRef.current;
    if (!line || !measure) return;
    const fit = () => {
      // Not laid out (hidden, or a test DOM without layout): nothing to measure, so show every chip.
      if (line.clientWidth === 0) return setVisible(filters.length);
      const widths = [...measure.children].map((el) => el.getBoundingClientRect().width);
      const chips = widths.slice(0, filters.length);
      const [moreWidth, clearWidth] = widths.slice(filters.length);
      setVisible(chipsThatFit(chips, line.clientWidth, moreWidth, clearWidth, CHIP_GAP));
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(line);
    return () => observer.disconnect();
  }, [filters]);

  return { lineRef, measureRef, visible: Math.min(visible, filters.length) };
}

const Chip: React.FC<{ filter: ActiveFilter; onRemove?: (key: FilterKey) => void }> = ({ filter, onRemove }) => (
  <span className="filter-chip">
    {filter.label}
    <button
      type="button"
      aria-label={`Remover filtro ${filter.label}`}
      tabIndex={onRemove ? 0 : -1}
      onClick={() => onRemove?.(filter.key)}
    >
      <X size={12} />
    </button>
  </span>
);

const moreLabel = (hidden: number) => `+${hidden} ${hidden === 1 ? 'filtro' : 'filtros'}`;

/**
 * The active filters as removable chips, always on one line: those that do not fit become "+N filtros",
 * which opens the filter panel.
 *
 * @example <FilterChips filters={active} onRemove={remove} onShowAll={openPanel} onClear={clear} />
 */
export const FilterChips: React.FC<FilterChipsProps> = ({ filters, onRemove, onShowAll, onClear }) => {
  const { lineRef, measureRef, visible } = useVisibleChips(filters);
  const hidden = filters.length - visible;
  return (
    <div className="filter-chips" ref={lineRef} aria-label="Filtros ativos">
      <div className="filter-chips__measure" ref={measureRef} aria-hidden="true">
        {filters.map((f) => (
          <Chip key={f.key} filter={f} />
        ))}
        <span className="link-button">{moreLabel(filters.length)}</span>
        <span className="link-button">Limpar</span>
      </div>
      {filters.slice(0, visible).map((f) => (
        <Chip key={f.key} filter={f} onRemove={onRemove} />
      ))}
      {hidden > 0 && (
        <button type="button" className="link-button" onClick={onShowAll}>
          {moreLabel(hidden)}
        </button>
      )}
      {filters.length > 0 && (
        <button type="button" className="link-button" onClick={onClear}>
          Limpar
        </button>
      )}
    </div>
  );
};

interface PagerProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (updater: (page: number) => number) => void;
}

const CompactPager: React.FC<PagerProps> = ({ currentPage, totalPages, onPageChange }) => (
  <span className="result-line__pager">
    <button
      type="button"
      className="btn-ghost btn-ghost--icon"
      aria-label="Página anterior"
      disabled={currentPage === 1}
      onClick={() => onPageChange((p) => Math.max(1, p - 1))}
    >
      <ChevronLeft size={16} />
    </button>
    {currentPage} / {totalPages}
    <button
      type="button"
      className="btn-ghost btn-ghost--icon"
      aria-label="Próxima página"
      disabled={currentPage === totalPages}
      onClick={() => onPageChange((p) => Math.min(totalPages, p + 1))}
    >
      <ChevronRight size={16} />
    </button>
  </span>
);

/**
 * "3 artigos", "1 artigo" or "8 de 52 artigos": the noun agrees with the total it follows.
 *
 * @example resultCountLabel(1, 3) // "1 de 3 artigos"
 */
export function resultCountLabel(shown: number, total: number): string {
  const noun = total === 1 ? 'artigo' : 'artigos';
  return shown === total ? `${total} ${noun}` : `${shown} de ${total} ${noun}`;
}

interface ResultLineProps extends FilterChipsProps, PagerProps {
  shown: number;
  total: number;
  onStartSelection: () => void;
}

/**
 * The line above the table: how many articles the filters leave, the active filters that explain it,
 * "Selecionar" (multi-select) and the page switcher when there is more than one page.
 *
 * @example <ResultLine shown={8} total={52} filters={active} ... />
 */
export const ResultLine: React.FC<ResultLineProps> = ({ shown, total, onStartSelection, ...rest }) => (
  <div className="result-line">
    <span className="result-line__total">{resultCountLabel(shown, total)}</span>
    <FilterChips filters={rest.filters} onRemove={rest.onRemove} onShowAll={rest.onShowAll} onClear={rest.onClear} />
    <button type="button" className="btn-ghost" onClick={onStartSelection}>
      <SquareCheck size={16} /> Selecionar
    </button>
    {rest.totalPages > 1 && (
      <CompactPager currentPage={rest.currentPage} totalPages={rest.totalPages} onPageChange={rest.onPageChange} />
    )}
  </div>
);

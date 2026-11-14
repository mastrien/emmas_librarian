import React, { useEffect, useRef, useState } from 'react';
import { Filter } from 'lucide-react';
import type { ProjectFiltering } from '../../hooks/useProjectFiltering';
import { activeFilters, clearedFilters } from '../../hooks/articleFilters';
import { AvailabilityGroup, DatabasesGroup, DocTypeGroup, KeywordsGroup, type GroupProps } from './filterGroups';
import { YearRangeGroup } from './YearRangeGroup';

// Closes on Escape (focus back on the button) and on a click outside; "Esc fecha só a camada de cima".
function useDismiss(open: boolean, close: () => void, containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onPointer = (e: MouseEvent) => !containerRef.current?.contains(e.target as Node) && close();
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open, close, containerRef]);
}

const PopoverGroups: React.FC<{ filtering: ProjectFiltering; group: GroupProps }> = ({ filtering, group }) => (
  <div className="filters-popover__body">
    <AvailabilityGroup {...group} />
    {filtering.uniqueDatabases.length > 0 && <DatabasesGroup databases={filtering.uniqueDatabases} {...group} />}
    {filtering.yearBars.bars.length > 0 && <YearRangeGroup histogram={filtering.yearBars} {...group} />}
    {filtering.keywordFrequencies.length > 0 && (
      <KeywordsGroup keywords={filtering.keywordFrequencies.map((k) => k.keyword)} {...group} />
    )}
    {filtering.uniqueDocTypes.length > 0 && <DocTypeGroup types={filtering.uniqueDocTypes} {...group} />}
  </div>
);

/**
 * "Filtros" with the number of active filters, opening a popover under it (board 153): availability, bases, year
 * range, keywords and document type, each option with what it would leave. Filters apply at once; the footer
 * clears them or closes with the count they leave.
 *
 * @example <FiltersPopover filtering={filtering} />
 */
export const FiltersPopover: React.FC<{ filtering: ProjectFiltering }> = ({ filtering }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = React.useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);
  useDismiss(open, close, containerRef);
  const { criteria, applyCriteria, countFor } = filtering;
  const active = activeFilters(criteria).length;
  const group: GroupProps = { criteria, apply: (patch) => applyCriteria({ ...criteria, ...patch }), countFor };
  const shown = filtering.activeArticles.length;
  return (
    <span className="filters-anchor" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`btn-secondary filters-button${active ? ' is-on' : ''}`}
        aria-expanded={open}
        aria-controls="article-filters"
        aria-label={active ? `Filtros (${active} ativos)` : 'Filtros'}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Filter size={16} /> Filtros
        {active > 0 && <span className="filter-count">{active}</span>}
      </button>
      {open && (
        <div id="article-filters" className="filters-popover" role="dialog" aria-label="Filtros">
          <PopoverGroups filtering={filtering} group={group} />
          <div className="filters-popover__foot">
            <button type="button" className="btn-ghost" onClick={() => applyCriteria(clearedFilters(criteria))}>
              Limpar
            </button>
            <button type="button" className="btn-primary" onClick={close}>
              Mostrar {shown} {shown === 1 ? 'artigo' : 'artigos'}
            </button>
          </div>
        </div>
      )}
    </span>
  );
};

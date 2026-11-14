import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTH_NAMES } from '../calendar/calendarDays';

/**
 * Previous month, the month shown, next month and "Hoje", beside the agenda's title (board 172).
 *
 * @example <MonthNav year={2025} month={3} onMove={(delta) => go(delta)} onToday={goToday} />
 */
export const MonthNav: React.FC<{
  year: number;
  month: number;
  onMove: (delta: number) => void;
  onToday: () => void;
}> = ({ year, month, onMove, onToday }) => (
  <div className="month-nav">
    <button type="button" className="month-nav__arrow" aria-label="Mês anterior" onClick={() => onMove(-1)}>
      <ChevronLeft size={16} aria-hidden="true" />
    </button>
    <span className="month-nav__label" aria-live="polite">
      {MONTH_NAMES[month]} de {year}
    </span>
    <button type="button" className="month-nav__arrow" aria-label="Próximo mês" onClick={() => onMove(1)}>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
    <button type="button" className="btn-secondary month-nav__today" onClick={onToday}>
      Hoje
    </button>
  </div>
);

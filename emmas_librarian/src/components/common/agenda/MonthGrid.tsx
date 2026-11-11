import React from 'react';
import { WEEKDAYS } from '../calendar/calendarDays';
import { chipsByDay, monthCells, type DayChip } from './monthDays';
import type { ScientificVenue } from '../../../types';

interface MonthGridProps {
  year: number;
  month: number;
  venues: ScientificVenue[];
  /** yyyy-mm-dd of today, to mark its number. */
  todayIso: string;
  /** Clicking a day passes its date, to start a new event there. */
  onSelectDay: (iso: string) => void;
}

const chipStyle = (chip: DayChip): React.CSSProperties | undefined =>
  chip.color ? ({ '--venue-color': chip.color, '--venue-tint': `${chip.color}2e` } as React.CSSProperties) : undefined;

const DayChips: React.FC<{ chips: DayChip[] }> = ({ chips }) => (
  <>
    {chips.map((chip) => (
      <span
        key={chip.key}
        className={chip.done ? 'month-grid__chip is-done' : 'month-grid__chip'}
        style={chipStyle(chip)}
      >
        {chip.text}
      </span>
    ))}
  </>
);

/**
 * The month of the agenda (board 172): weeks from Sunday, each day with a chip per deadline in its event's colour; a
 * range repeats on each of its days. A click on a day starts an event dated that day.
 *
 * @example <MonthGrid year={2025} month={3} venues={venues} todayIso="2025-04-08" onSelectDay={add} />
 */
export const MonthGrid: React.FC<MonthGridProps> = ({ year, month, venues, todayIso, onSelectDay }) => {
  const chips = chipsByDay(venues);
  return (
    <div className="month-grid" data-testid="month-grid" role="grid" aria-label="Calendário do mês">
      {WEEKDAYS.map((day) => (
        <div key={day} className="month-grid__head" role="columnheader">
          {day}
        </div>
      ))}
      {monthCells(year, month).map((cell) => (
        <div
          key={cell.iso}
          role="gridcell"
          className={['month-grid__day', cell.outside && 'is-outside', cell.iso === todayIso && 'is-today']
            .filter(Boolean)
            .join(' ')}
          title={cell.iso.split('-').reverse().join('/')}
          onClick={() => onSelectDay(cell.iso)}
        >
          <span className="month-grid__number">{cell.day}</span>
          <DayChips chips={chips.get(cell.iso) ?? []} />
        </div>
      ))}
    </div>
  );
};

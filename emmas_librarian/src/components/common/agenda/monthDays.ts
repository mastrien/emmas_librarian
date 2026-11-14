import type { ScientificVenue } from '../../../types';
import { isoDay } from '../calendar/calendarDays';
import { milestoneLastDay, parseDay } from './deadlineDates';

export interface MonthCell {
  iso: string;
  day: number;
  /** A day of the neighbouring months that fills the first or last week. */
  outside: boolean;
}

/**
 * The days a month grid shows, whole weeks starting on Sunday (five or six).
 *
 * @example monthCells(2025, 3).length // 35 (April 2025; month is 0-based)
 */
export function monthCells(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1);
  const weeks = Math.ceil((first.getDay() + new Date(year, month + 1, 0).getDate()) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = new Date(year, month, 1 - first.getDay() + i);
    return {
      iso: isoDay(date.getFullYear(), date.getMonth(), date.getDate()),
      day: date.getDate(),
      outside: date.getMonth() !== month,
    };
  });
}

export interface DayChip {
  key: string;
  /** "SBSR · Evento" on the first day of a deadline, the acronym alone on the days that follow. */
  text: string;
  color?: string;
  done: boolean;
}

// A range longer than this is drawn on its first days only, so a wrong year cannot fill the whole grid.
const MAX_RANGE_DAYS = 62;

function nextDay(iso: string): string {
  const date = parseDay(iso);
  return isoDay(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function addChip(map: Map<string, DayChip[]>, iso: string, chip: DayChip): void {
  map.set(iso, [...(map.get(iso) ?? []), chip]);
}

/**
 * The chips of every day with a deadline: one per day of a range, the first with the deadline's name.
 *
 * @example chipsByDay(venues).get('2025-04-06') // [{ text: 'SBSR · Evento', … }]
 */
export function chipsByDay(venues: ScientificVenue[]): Map<string, DayChip[]> {
  const map = new Map<string, DayChip[]>();
  for (const venue of venues) {
    const name = venue.acronym || venue.title;
    for (const m of venue.milestones ?? []) {
      const last = milestoneLastDay(m);
      const done = m.status === 'completed';
      let iso = m.target_date;
      for (let n = 0; n < MAX_RANGE_DAYS; n++) {
        addChip(map, iso, {
          key: `${m.id ?? m.label}-${iso}`,
          text: n === 0 ? `${name} · ${m.label}` : name,
          color: venue.color,
          done,
        });
        if (iso >= last) break;
        iso = nextDay(iso);
      }
    }
  }
  return map;
}

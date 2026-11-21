import type { DiaryEntry } from '../../../src/types';

/** The dates the diary can show, oldest to newest: the pages that exist, plus today when it can be written. */
export function pageDates(entries: DiaryEntry[], today: string, writable: boolean): string[] {
  const dates = new Set(entries.map((entry) => entry.entry_date));
  if (writable) dates.add(today);
  return [...dates].sort();
}

/** The date a diary opens on: today where it can be written, else the newest page. */
export function openingDate(entries: DiaryEntry[], today: string, writable: boolean): string | null {
  if (writable) return today;
  return pageDates(entries, today, false).at(-1) ?? null;
}

/** The date before or after `current` among `dates` (already sorted), or null at the end. */
export function neighbour(dates: string[], current: string, step: -1 | 1): string | null {
  const earlier = dates.filter((date) => date < current);
  const later = dates.filter((date) => date > current);
  return step === -1 ? (earlier.at(-1) ?? null) : (later[0] ?? null);
}

export interface MonthGrid {
  /** "novembro de 2026". */
  title: string;
  /** Empty cells before day 1, so the grid starts on a Sunday. */
  leadingBlanks: number;
  /** ISO dates of the days of the month. */
  days: string[];
}

/**
 * The month a date is in, laid out for a calendar.
 *
 * @example monthGrid('2026-11-21') // { title: 'novembro de 2026', leadingBlanks: 0, days: ['2026-11-01', …] }
 */
export function monthGrid(isoDate: string): MonthGrid {
  const [year, month] = isoDate.split('-').map(Number);
  const first = new Date(year, month - 1, 1, 12);
  const count = new Date(year, month, 0).getDate();
  const title = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    title,
    leadingBlanks: first.getDay(),
    days: Array.from({ length: count }, (_unused, index) => `${year}-${pad(month)}-${pad(index + 1)}`),
  };
}

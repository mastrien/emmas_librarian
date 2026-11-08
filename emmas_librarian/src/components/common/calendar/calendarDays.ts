import type { ScientificVenue } from '../../../types';

export const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function addColor(map: Map<string, string[]>, date: string, color: string): void {
  const colors = map.get(date) || [];
  if (!colors.includes(color)) colors.push(color);
  map.set(date, colors);
}

/**
 * For each date with a deadline, the colours of the venues due that day (a range marks its start and its end).
 *
 * @example deadlineColorsByDate(venues).get('2026-11-10') // ['#db2777']
 */
export function deadlineColorsByDate(venues: ScientificVenue[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const v of venues) {
    const color = v.color || 'var(--color-primary)';
    for (const m of v.milestones || []) {
      if (m.target_date) addColor(map, m.target_date, color);
      if (m.field_type === 'range' && m.end_date) addColor(map, m.end_date, color);
    }
  }
  return map;
}

/**
 * A day of the month as yyyy-mm-dd.
 *
 * @example isoDay(2026, 10, 7) // '2026-11-07' (month is 0-based)
 */
export function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The tooltip of a day: its date, then what it holds.
 *
 * @example dayTitle(new Date(2026, 10, 7), { diary: true, deadlines: 2, today: true })
 */
export function dayTitle(date: Date, marks: { diary: boolean; deadlines: number; today: boolean }): string {
  const parts = [date.toLocaleDateString()];
  if (marks.diary) parts.push('Atividade no Diário');
  if (marks.deadlines > 0) parts.push(`${marks.deadlines} Prazo(s)`);
  if (marks.today) parts.push('(Hoje)');
  return parts.join(' • ');
}

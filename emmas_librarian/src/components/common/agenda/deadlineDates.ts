import type { ScientificMilestone } from '../../../types';

const DAY_MS = 86_400_000;

/** A deadline pending for longer than this is hidden from the list unless the author asks (board 173). */
export const STALE_AFTER_DAYS = 60;

/** A yyyy-mm-dd string as local midnight, so day arithmetic ignores the time zone and daylight saving. */
export function parseDay(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Whole days from `from` to `to` by calendar day (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / DAY_MS);
}

/** The day a deadline ends: the end of a range, or its only date. */
export function milestoneLastDay(m: ScientificMilestone): string {
  return m.field_type === 'range' && m.end_date ? m.end_date : m.target_date;
}

export type MilestoneSituation =
  | { kind: 'done' }
  | { kind: 'overdue'; days: number }
  | { kind: 'today' }
  | { kind: 'upcoming'; days: number };

/**
 * Where a deadline stands today: done, overdue by N days, due today or N days ahead.
 *
 * @example milestoneSituation(m, new Date(2026, 10, 10)) // { kind: 'overdue', days: 3 }
 */
export function milestoneSituation(m: ScientificMilestone, today: Date): MilestoneSituation {
  if (m.status === 'completed') return { kind: 'done' };
  const days = daysBetween(today, parseDay(milestoneLastDay(m)));
  if (days < 0) return { kind: 'overdue', days: -days };
  return days === 0 ? { kind: 'today' } : { kind: 'upcoming', days };
}

/**
 * The short text of a situation, as the "Situação" column shows it.
 *
 * @example situationText({ kind: 'overdue', days: 213 }) // 'venceu há 213 d'
 */
export function situationText(situation: MilestoneSituation): string {
  if (situation.kind === 'done') return 'feito';
  if (situation.kind === 'today') return 'hoje';
  return situation.kind === 'overdue' ? `venceu há ${situation.days} d` : `em ${situation.days} d`;
}

/** Pending and overdue by more than the limit: the deadlines the list hides unless asked. */
export function isStale(m: ScientificMilestone, today: Date): boolean {
  const situation = milestoneSituation(m, today);
  return situation.kind === 'overdue' && situation.days > STALE_AFTER_DAYS;
}

const br = (iso: string): string => iso.split('-').reverse().join('/');

/**
 * A deadline's date as the agenda shows it, day first: "06 a 09/04/2025" for a range in one month, otherwise both
 * dates in full; a single date may carry its time ("10/03/2025 às 23:59").
 *
 * @example formatMilestoneDate(range) // '06 a 09/04/2025'
 */
export function formatMilestoneDate(m: ScientificMilestone): string {
  if (m.field_type === 'range' && m.end_date) {
    const [start, end] = [br(m.target_date), br(m.end_date)];
    const sameMonth = m.target_date.slice(0, 7) === m.end_date.slice(0, 7);
    return sameMonth ? `${start.slice(0, 2)} a ${end}` : `${start} a ${end}`;
  }
  return m.has_time && m.target_time ? `${br(m.target_date)} às ${m.target_time}` : br(m.target_date);
}

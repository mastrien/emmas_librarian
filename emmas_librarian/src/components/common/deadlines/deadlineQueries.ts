import type { ScientificMilestone, ScientificVenue } from '../../../types';

export interface DeadlineItem {
  venue: ScientificVenue;
  milestone: ScientificMilestone;
  effectiveDate: string;
  daysDiff: number;
}

export type DeadlineTone = 'upcoming' | 'urgent' | 'today' | 'overdue';

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * The pending deadlines, nearest (or most overdue) first, at most `limit`. A range counts by its end date.
 *
 * @example upcomingDeadlines(venues, '2026-11-07', 4)
 */
export function upcomingDeadlines(venues: ScientificVenue[], todayIso: string, limit: number): DeadlineItem[] {
  const todayMs = new Date(todayIso).getTime();
  const items = venues.flatMap((venue) =>
    (venue.milestones || [])
      .filter((m) => m.status !== 'completed')
      .map((milestone) => ({
        venue,
        milestone,
        effectiveDate:
          milestone.field_type === 'range' && milestone.end_date ? milestone.end_date : milestone.target_date,
      }))
      .filter((item) => item.effectiveDate)
      .map((item) => ({ ...item, daysDiff: Math.ceil((new Date(item.effectiveDate).getTime() - todayMs) / DAY_MS) })),
  );
  return items.sort((a, b) => a.daysDiff - b.daysDiff).slice(0, limit);
}

/**
 * How close a deadline is, as the badge says it: overdue, today, within a week, or later.
 *
 * @example deadlineBadge(-3) // { tone: 'overdue', text: 'Venceu há 3 d' }
 */
export function deadlineBadge(daysDiff: number): { tone: DeadlineTone; text: string } {
  if (daysDiff === 0) return { tone: 'today', text: 'Hoje!' };
  if (daysDiff < 0) return { tone: 'overdue', text: `Venceu há ${Math.abs(daysDiff)} d` };
  if (daysDiff <= 7) return { tone: 'urgent', text: `Em ${daysDiff} dias` };
  return { tone: 'upcoming', text: `Em ${daysDiff} dias` };
}

import type { MilestoneStatus, ScientificMilestone, ScientificVenue, VenueCategory } from '../../../types';

export const CATEGORY_LABELS: Record<VenueCategory, string> = {
  conference: 'Congresso',
  journal: 'Periódico',
  workshop: 'Workshop',
  symposium: 'Simpósio',
  other: 'Outros',
};

export type CategoryFilter = VenueCategory | 'all';
export type StatusFilter = MilestoneStatus | 'all';

export interface MilestoneWithVenue {
  milestone: ScientificMilestone;
  venue: ScientificVenue;
}

function matchesQuery(venue: ScientificVenue, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const inTitle = venue.title.toLowerCase().includes(q) || Boolean(venue.acronym?.toLowerCase().includes(q));
  return inTitle || (venue.milestones || []).some((m) => m.label.toLowerCase().includes(q));
}

/**
 * The venues of the category that match the search in their title, acronym or a deadline's name.
 *
 * @example filterVenues(venues, 'journal', 'sbbd')
 */
export function filterVenues(venues: ScientificVenue[], category: CategoryFilter, query: string): ScientificVenue[] {
  return venues.filter((v) => (category === 'all' || v.category === category) && matchesQuery(v, query));
}

/**
 * Every deadline of the venues with its venue, of the given status, earliest date first.
 *
 * @example milestonesByDate(filterVenues(venues, 'all', ''), 'pending')
 */
export function milestonesByDate(venues: ScientificVenue[], status: StatusFilter): MilestoneWithVenue[] {
  return venues
    .flatMap((venue) =>
      (venue.milestones || [])
        .filter((m) => status === 'all' || m.status === status)
        .map((milestone) => ({ milestone, venue })),
    )
    .sort((a, b) => a.milestone.target_date.localeCompare(b.milestone.target_date));
}

/**
 * The venues with one deadline's status changed, for the optimistic update before the save returns.
 *
 * @example withMilestoneStatus(venues, 12, 'completed')
 */
export function withMilestoneStatus(
  venues: ScientificVenue[],
  milestoneId: number,
  status: MilestoneStatus,
): ScientificVenue[] {
  return venues.map((v) => ({
    ...v,
    milestones: (v.milestones || []).map((m) => (m.id === milestoneId ? { ...m, status } : m)),
  }));
}

/**
 * A deadline's date as the agenda shows it: a range, or the date with its time. The card and the list join the time
 * differently ("2026-11-06 14:00" vs "2026-11-06 às 14:00"), as they always did.
 *
 * @example milestoneDateText(m, ' às ') // '2026-11-06 às 14:00'
 */
export function milestoneDateText(m: ScientificMilestone, timeJoin: ' ' | ' às '): string {
  if (m.field_type === 'range' && m.end_date) return `${m.target_date} a ${m.end_date}`;
  return `${m.target_date}${m.has_time && m.target_time ? `${timeJoin}${m.target_time}` : ''}`;
}

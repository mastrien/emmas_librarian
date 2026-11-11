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

export interface MonthGroup {
  /** "Abril de 2025". */
  label: string;
  items: MilestoneWithVenue[];
}

const MONTHS = [
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

/**
 * The deadlines grouped by the month of their first date, keeping the order they came in.
 *
 * @example groupByMonth(milestonesByDate(venues, 'pending'))[0].label // 'Abril de 2025'
 */
export function groupByMonth(items: MilestoneWithVenue[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const item of items) {
    const [year, month] = item.milestone.target_date.split('-').map(Number);
    const label = `${MONTHS[month - 1]} de ${year}`;
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

export interface StatusCounts {
  pending: number;
  completed: number;
  all: number;
}

/**
 * How many deadlines are pending, done and in all, for the counts on the status filter.
 *
 * @example statusCounts(milestonesByDate(venues, 'all')) // { pending: 2, completed: 1, all: 3 }
 */
export function statusCounts(items: MilestoneWithVenue[]): StatusCounts {
  const completed = items.filter((item) => item.milestone.status === 'completed').length;
  return { pending: items.length - completed, completed, all: items.length };
}

import type { Project } from '../../types';

// The numbers of the home screen (board 151): the totals over every project and the order of the project cards.

type Stats = NonNullable<Project['stats']>;

/** Everything the "Visão geral" tiles and the calendar need, summed over the projects. */
export interface HomeTotals {
  total: number;
  active: number;
  read: number;
  archived: number;
  withPdf: number;
  withoutPdf: number;
  /** Days with a diary entry in any project, for the calendar. */
  diaryDays: Set<string>;
}

/**
 * Sums the articles of every project.
 *
 * @example homeTotals([{ stats: { total: 3, read: 1, … } }]).total // 3
 */
export function homeTotals(projects: Pick<Project, 'stats'>[]): HomeTotals {
  const totals: HomeTotals = {
    total: 0,
    active: 0,
    read: 0,
    archived: 0,
    withPdf: 0,
    withoutPdf: 0,
    diaryDays: new Set(),
  };
  for (const { stats } of projects) {
    if (!stats) continue;
    totals.total += stats.total;
    totals.active += stats.active;
    totals.read += stats.read;
    totals.archived += stats.archived;
    totals.withPdf += stats.withPdf;
    stats.diaryDates?.forEach((day) => totals.diaryDays.add(day));
  }
  totals.withoutPdf = totals.total - totals.withPdf;
  return totals;
}

/**
 * How much of what is being read was read, in whole percent: the archived articles are out of the count.
 *
 * @example readPercent({ active: 89, read: 7 }) // 7
 */
export function readPercent(stats: Pick<Stats, 'active' | 'read'>): number {
  const reading = stats.active + stats.read;
  return reading === 0 ? 0 : Math.round((100 * stats.read) / reading);
}

/**
 * A share of a total in whole percent, 0 when the total is 0.
 *
 * @example sharePercent(17, 96) // 18
 */
export function sharePercent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((100 * part) / whole);
}

export type ProjectOrder = 'recent' | 'az';

type Ordered = Pick<Project, 'name' | 'created_at' | 'last_opened_at'>;

/** The last sign of life of a project: when it was opened, or else when it was created. */
const lastActivity = (project: Pick<Project, 'created_at' | 'last_opened_at'>): string =>
  project.last_opened_at ?? project.created_at;

/**
 * The projects in the chosen order: the most recently opened first (a project never opened counts from its
 * creation), or by name (accents and case ignored).
 *
 * @example sortProjects(projects, 'az').map((p) => p.name)
 */
export function sortProjects<T extends Ordered>(projects: T[], order: ProjectOrder): T[] {
  const sorted = [...projects];
  if (order === 'az') return sorted.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  return sorted.sort((a, b) => new Date(lastActivity(b)).getTime() - new Date(lastActivity(a)).getTime());
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "aberto há 2 h" for a card (board 151); nothing for a project that was never opened.
 *
 * @example openedAgo('2026-11-10T20:00:00Z', new Date('2026-11-10T22:30:00Z')) // 'aberto há 2 h'
 */
export function openedAgo(openedAt: string | null | undefined, now: Date): string | null {
  if (!openedAt) return null;
  const elapsed = Math.max(0, now.getTime() - new Date(openedAt).getTime());
  if (elapsed < MINUTE) return 'aberto agora';
  if (elapsed < HOUR) return `aberto há ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `aberto há ${Math.floor(elapsed / HOUR)} h`;
  if (elapsed < 30 * DAY) return `aberto há ${Math.floor(elapsed / DAY)} d`;
  return `aberto em ${new Date(openedAt).toLocaleDateString('pt-BR')}`;
}

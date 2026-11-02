import type { SearchHistoryItem } from '../types';

/** The intervals a monitored search can have, in days. */
export const MONITOR_INTERVALS = [1, 7, 14] as const;
export type MonitorInterval = (typeof MONITOR_INTERVALS)[number];

export const MONITOR_INTERVAL_NAMES: Record<MonitorInterval, string> = {
  1: 'Todo dia',
  7: 'Toda semana',
  14: 'A cada 2 semanas',
};

// An article can be published well before it is indexed. Looking back this far catches those, and what the project
// has or what was already shown never counts, so overlapping does no harm. It stays above the longest interval.
export const MONITOR_MARGIN_DAYS = 30;

const DAY_MS = 86_400_000;

// SQLite's CURRENT_TIMESTAMP has no zone and is UTC.
const toTime = (date: string) => new Date(date.includes('T') ? date : `${date.replace(' ', 'T')}Z`).getTime();

/**
 * Whether a monitored search is due: never checked, or its interval passed.
 *
 * @example isMonitorDue({ interval_days: 7, last_checked_at: null }, new Date()) // true
 */
export function isMonitorDue(monitor: { interval_days: number; last_checked_at: string | null }, now: Date): boolean {
  if (!monitor.last_checked_at) return true;
  return now.getTime() - toTime(monitor.last_checked_at) >= monitor.interval_days * DAY_MS;
}

/**
 * The publication date a check looks from: the last check (or the search itself), minus the margin.
 *
 * @example monitorSinceDate('2026-11-01T10:00:00.000Z') // '2026-10-02'
 */
export function monitorSinceDate(lastDate: string): string {
  return new Date(toTime(lastDate) - MONITOR_MARGIN_DAYS * DAY_MS).toISOString().slice(0, 10);
}

const RESULT_PREFIX = 'Monitoramento da busca #';

/**
 * How a search saved from monitoring reads in the history, so it is told apart from one the person ran.
 *
 * @example monitorResultQuery(7, 'Título contém "x"') // 'Monitoramento da busca #7: Título contém "x"'
 */
export const monitorResultQuery = (searchId: number, query: string): string => `${RESULT_PREFIX}${searchId}: ${query}`;

/**
 * Whether a history entry came from monitoring. It is not offered for monitoring again: it has the same query as the
 * search that produced it.
 *
 * @example isMonitorResult({ unified_query: 'Monitoramento da busca #7: x' }) // true
 */
export const isMonitorResult = (item: Pick<SearchHistoryItem, 'unified_query'>): boolean =>
  item.unified_query.startsWith(RESULT_PREFIX);

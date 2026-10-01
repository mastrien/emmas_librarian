import type { SearchBreakdown, SearchHistoryItem } from '../../../types';
import { SEARCH_DATABASES } from '../../../pages/Search/searchQueries';
import type { SearchLimits } from '../../../utils/searchLimits';

const count = (n: number) => n.toLocaleString('pt-BR');
const label = (db: string) => SEARCH_DATABASES.find((d) => d.id === db)?.label ?? db;

/**
 * Parses a JSON column of a history entry; a malformed value (old or hand-edited data) yields `{}`
 * instead of breaking the whole history list.
 *
 * Usage:
 *   const breakdown = parseStoredObject<SearchBreakdown>(item.results_breakdown);
 */
export function parseStoredObject<T extends object>(raw: string | null | undefined): T {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) as T;
  } catch {
    return {} as T;
  }
}

/**
 * The limit line of a history entry: the common value, plus the per-base adjustments saved with the search.
 * Null for entries without a limit (imports, manual additions).
 *
 * Usage:
 *   historyLimitText(item); // "1.000 por base (Web of Science 500)"
 */
export function historyLimitText(item: SearchHistoryItem): string | null {
  if (item.limit_val === undefined || item.limit_val === null) return null;
  const limits = parseStoredObject<{ limits?: SearchLimits }>(item.query_state).limits;
  const adjustments = Object.entries(limits?.perBase ?? {}).map(([db, n]) => `${label(db)} ${count(n)}`);
  const common = `${count(item.limit_val)} por base`;
  return adjustments.length ? `${common} (${adjustments.join(', ')})` : common;
}

/**
 * The requests each base cost, for searches recorded after pagination; null when none were recorded.
 *
 * Usage:
 *   requestsText({ openalex: { count: 1000, requests: 10 } }); // "OpenAlex 10"
 */
export function requestsText(breakdown: SearchBreakdown): string | null {
  const parts = Object.entries(breakdown)
    .filter(([, outcome]) => typeof outcome.requests === 'number')
    .map(([db, outcome]) => `${label(db)} ${count(outcome.requests!)}`);
  return parts.length ? parts.join(' · ') : null;
}

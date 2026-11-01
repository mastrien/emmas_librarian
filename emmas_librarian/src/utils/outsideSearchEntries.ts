import type { SearchHistoryItem } from '../types';

/**
 * Every movement of articles into a project is logged in the search history, even when no search ran: an
 * article added by hand or a batch of PDFs is logged under the base "Manual", a copy from another project under
 * "import". The PRISMA diagram (#50) sends those articles to "Identificação por outros métodos", so the names
 * live here once, for the code that writes the history and the code that reads it.
 */
export const OUTSIDE_SEARCH_BASES = { manual: 'Manual', projectImport: 'import' } as const;

const NAMES: readonly string[] = Object.values(OUTSIDE_SEARCH_BASES);

/**
 * True when a history entry logged articles that came from outside a structured search: every base of its
 * breakdown is one of OUTSIDE_SEARCH_BASES. An entry with no bases is not one of them.
 *
 * @example isOutsideSearchBreakdown({ Manual: { count: 1 } }) // true
 */
export function isOutsideSearchBreakdown(breakdown: Record<string, unknown>): boolean {
  const bases = Object.keys(breakdown);
  return bases.length > 0 && bases.every((base) => NAMES.includes(base));
}

function breakdownOf(entry: Pick<SearchHistoryItem, 'results_breakdown'>): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(entry.results_breakdown || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * True when a saved history entry only logged articles brought from outside a structured search.
 *
 * @example isOutsideSearchEntry({ results_breakdown: '{"Manual":{"count":1}}' }) // true
 */
export function isOutsideSearchEntry(entry: Pick<SearchHistoryItem, 'results_breakdown'>): boolean {
  return isOutsideSearchBreakdown(breakdownOf(entry));
}

/**
 * The ids of the history entries that only logged articles from outside the searches.
 *
 * @example outsideSearchIds(history).has(article.search_id ?? -1)
 */
export function outsideSearchIds(history: SearchHistoryItem[]): Set<number> {
  return new Set(history.filter(isOutsideSearchEntry).map((entry) => entry.id));
}

import type { SearchBreakdown, SearchHistoryItem } from '../types';

/** What one saved search contributes to the identification step, base by base. */
export interface SearchContribution {
  searchId: number;
  date: string;
  /** Results per base as the base returned them, before removing duplicates. */
  bases: { base: string; count: number; partial: boolean }[];
  found: number;
  /** Distinct results across the bases; null for searches saved before the app recorded it. */
  unique: number | null;
  /** Results new to the project when the search was saved (the others merged into articles already there). */
  added: number | null;
}

function breakdownOf(search: SearchHistoryItem): SearchBreakdown {
  try {
    const parsed: unknown = JSON.parse(search.results_breakdown || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as SearchBreakdown) : {};
  } catch {
    return {};
  }
}

// A base that returned exactly what was asked for, or less than it said it had, may have had more results.
const isPartial = (count: number, requested?: number, available?: number) =>
  (requested !== undefined && count >= requested) || (available !== undefined && available > count);

/**
 * Reads a saved search as the PRISMA diagram needs it. `total_results` only means "new to the project" for
 * searches that also recorded `unique_results`; for older ones both stay null ("sem dados"), never estimated.
 *
 * @example searchContribution(search).bases // [{ base: 'scopus', count: 100, partial: true }]
 */
export function searchContribution(search: SearchHistoryItem): SearchContribution {
  const bases = Object.entries(breakdownOf(search))
    .filter(([, outcome]) => outcome && !outcome.error)
    .map(([base, outcome]) => ({
      base,
      count: outcome.count ?? 0,
      partial: isPartial(outcome.count ?? 0, outcome.requested, outcome.available),
    }));
  const recorded = search.unique_results !== null && search.unique_results !== undefined;
  return {
    searchId: search.id,
    date: search.created_at,
    bases,
    found: bases.reduce((n, b) => n + b.count, 0),
    unique: recorded ? Number(search.unique_results) : null,
    added: recorded ? search.total_results : null,
  };
}

const BASE_NAMES: Record<string, string> = {
  openalex: 'OpenAlex',
  crossref: 'Crossref',
  scopus: 'Scopus',
  wos: 'Web of Science',
  europepmc: 'Europe PMC',
  arxiv: 'arXiv',
  ieee: 'IEEE Xplore',
};

/**
 * A base's name as people know it.
 *
 * @example baseName('wos') // 'Web of Science'
 */
export function baseName(base: string): string {
  return BASE_NAMES[base] ?? base;
}

/** The bibliographic bases the search can query, by the keys used in query maps and breakdowns. */
export type SearchBaseId = 'openalex' | 'crossref' | 'scopus' | 'wos';

interface BaseLimit {
  /** The most results the app asks of the base in one search. */
  max: number;
  /** Results per request, the largest the API serves. */
  pageSize: number;
  /** Pause between requests, for bases with a per-second quota. */
  pageIntervalMs: number;
}

/**
 * How each base is paged. Ceilings: Scopus stops at 5,000 (its `start` offset limit); WoS 2,500 is 50 pages
 * of 50, the whole daily quota of the free trial plan; OpenAlex and Crossref publish no ceiling, so 10,000
 * keeps a search within their daily budgets. Page sizes: OpenAlex 100 (200 is deprecated), Crossref 1,000,
 * Scopus 200 (STANDARD view), WoS 50, one request per second on the free trial (see
 * docs/pesquisas/2026-09-27_paginacao_apis_busca.md).
 */
export const SEARCH_LIMITS: Record<SearchBaseId, BaseLimit> = {
  openalex: { max: 10000, pageSize: 100, pageIntervalMs: 0 },
  crossref: { max: 10000, pageSize: 1000, pageIntervalMs: 0 },
  scopus: { max: 5000, pageSize: 200, pageIntervalMs: 0 },
  wos: { max: 2500, pageSize: 50, pageIntervalMs: 1100 },
};

/** Pre-filled common limit for a new search. */
export const DEFAULT_SEARCH_LIMIT = 1000;

/** How many results to ask of each base: one common value, optionally adjusted per base. */
export interface SearchLimits {
  common: number;
  perBase: Partial<Record<SearchBaseId, number>>;
}

/** A base whose limit the search cannot use as typed. */
export interface SearchLimitProblem {
  base: SearchBaseId;
  value: number;
  max: number;
  /** True when the value comes from the common limit rather than a per-base adjustment. */
  fromCommon: boolean;
}

export const isSearchBase = (id: string): id is SearchBaseId => Object.hasOwn(SEARCH_LIMITS, id);

/**
 * A new search's limits: the default common value and no per-base adjustment.
 *
 * Usage:
 *   const [limits, setLimits] = useState(defaultSearchLimits);
 */
export function defaultSearchLimits(): SearchLimits {
  return { common: DEFAULT_SEARCH_LIMIT, perBase: {} };
}

/**
 * What asking a base for `limit` results costs at most: requests, and the seconds spent waiting between them.
 *
 * Usage:
 *   searchCost('wos', 1000); // { requests: 20, seconds: 21 }
 */
export function searchCost(base: SearchBaseId, limit: number): { requests: number; seconds: number } {
  const { pageSize, pageIntervalMs } = SEARCH_LIMITS[base];
  const requests = Math.max(1, Math.ceil(limit / pageSize));
  return { requests, seconds: Math.round(((requests - 1) * pageIntervalMs) / 1000) };
}

/**
 * The limit a base will use: its adjustment when there is one, the common value otherwise.
 *
 * Usage:
 *   effectiveLimit({ common: 1000, perBase: { wos: 500 } }, 'wos'); // 500
 */
export function effectiveLimit(limits: SearchLimits, base: SearchBaseId): number {
  return limits.perBase[base] ?? limits.common;
}

/**
 * The chosen bases whose limit is not a whole number between 1 and the base's ceiling. The search is
 * blocked while this is not empty, so it never runs differently from what the user sees.
 *
 * Usage:
 *   limitProblems({ common: 3000, perBase: {} }, ['openalex', 'wos']); // [{ base: 'wos', value: 3000, max: 2500, fromCommon: true }]
 */
export function limitProblems(limits: SearchLimits, bases: string[]): SearchLimitProblem[] {
  return bases.filter(isSearchBase).flatMap((base) => {
    const value = effectiveLimit(limits, base);
    const { max } = SEARCH_LIMITS[base];
    const ok = Number.isInteger(value) && value >= 1 && value <= max;
    return ok ? [] : [{ base, value, max, fromCommon: limits.perBase[base] === undefined }];
  });
}

/**
 * Checks limits received over IPC and returns the limit of each chosen base; throws on anything the
 * search page would have blocked, so a value above a ceiling never reaches an API.
 *
 * Usage:
 *   const perBase = validateSearchLimits(limits, Object.keys(queryMap)); // { openalex: 1000, wos: 500 }
 */
export function validateSearchLimits(limits: unknown, bases: string[]): Partial<Record<SearchBaseId, number>> {
  const shape = limits as SearchLimits | null;
  if (!shape || typeof shape !== 'object' || typeof shape.common !== 'number' || typeof shape.perBase !== 'object') {
    throw new Error(
      `[ERR_INVALID_SEARCH_LIMIT] Limites de busca inválidos. Offending value: ${JSON.stringify(limits)}. ` +
        'Expected shape: { common: number, perBase: { openalex?: number, crossref?: number, scopus?: number, wos?: number } }.',
    );
  }
  const problems = limitProblems(shape, bases);
  if (problems.length) {
    const offending = problems.map((p) => `${p.base}=${p.value}`).join(', ');
    const expected = problems.map((p) => `${p.base}: inteiro de 1 a ${p.max}`).join('; ');
    throw new Error(
      `[ERR_INVALID_SEARCH_LIMIT] Limite de busca fora do permitido. Offending value: ${offending}. Expected shape: ${expected}.`,
    );
  }
  return Object.fromEntries(bases.filter(isSearchBase).map((base) => [base, effectiveLimit(shape, base)]));
}

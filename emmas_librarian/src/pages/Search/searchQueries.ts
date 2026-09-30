import type {
  DatabaseTranslationMap,
  QueryASTNode,
  QueryField,
  QueryOperator,
  QuerySort,
  SearchHistoryItem,
  SearchQueryState,
} from '../../types';
import type { SearchLimits } from '../../utils/searchLimits';

export interface SearchDatabaseOption {
  id: string;
  label: string;
  /** Integrated but never run against the real API; the UI says so wherever the base can be picked. */
  experimental?: boolean;
}

export const SEARCH_DATABASES: ReadonlyArray<SearchDatabaseOption> = [
  { id: 'openalex', label: 'OpenAlex' },
  { id: 'crossref', label: 'Crossref' },
  { id: 'scopus', label: 'Scopus' },
  { id: 'wos', label: 'Web of Science' },
  { id: 'europepmc', label: 'Europe PMC' },
  { id: 'arxiv', label: 'arXiv' },
  // No IEEE key yet: the field syntax and the daily quota come from the docs only (docs/pesquisas/2026-09-28_novas_bases_busca.md).
  { id: 'ieee', label: 'IEEE Xplore', experimental: true },
];

/** Why a base is marked experimental, shown on the search page and next to its key in the settings. */
export const IEEE_EXPERIMENTAL_NOTE =
  'A IEEE Xplore está em fase experimental: a integração ainda não foi testada com uma chave real, então a busca pode falhar ou trazer resultados diferentes do site da IEEE.';

/** The builder's starting tree: one empty "Todos contém" rule. */
export const EMPTY_QUERY: QueryASTNode = {
  type: 'group',
  logicalOperator: 'AND',
  children: [{ type: 'rule', field: 'all', operator: 'contains', value: '' }],
};

export interface SearchApiKeys {
  scopus: string;
  wos: string;
  ieee: string;
}

/** Bases that need a configured API key before they can be selected. */
export const KEYED_DATABASES: ReadonlyArray<keyof SearchApiKeys> = ['scopus', 'wos', 'ieee'];

/** The setting that holds each keyed base's API key. */
export const API_KEY_SETTINGS: Record<keyof SearchApiKeys, string> = {
  scopus: 'scopus_api_key',
  wos: 'wos_api_key',
  ieee: 'ieee_api_key',
};

export const isKeyedDatabase = (db: string): db is keyof SearchApiKeys =>
  (KEYED_DATABASES as readonly string[]).includes(db);

/**
 * Reads the API key of every keyed base; a base without a key gets ''.
 *
 * Usage:
 *   const keys = await loadSearchApiKeys((key) => projectService.getSetting(key)); // { scopus: 'k', wos: '', ieee: '' }
 */
export async function loadSearchApiKeys(getSetting: (key: string) => Promise<string | null>): Promise<SearchApiKeys> {
  const values = await Promise.all(KEYED_DATABASES.map((db) => getSetting(API_KEY_SETTINGS[db])));
  return Object.fromEntries(KEYED_DATABASES.map((db, i) => [db, values[i] || ''])) as unknown as SearchApiKeys;
}

const FIELD_NAMES: Record<QueryField, string> = {
  all: 'Todos',
  title: 'Título',
  abstract: 'Resumo',
  authors: 'Autores',
};
const OPERATOR_NAMES: Record<QueryOperator, string> = {
  contains: 'contém',
  exact: 'é exatamente',
  not_contains: 'não contém',
};

/**
 * Portuguese description of the query tree, stored with the search history.
 *
 * Usage:
 *   describeQueryTree({ type: 'rule', field: 'title', operator: 'contains', value: 'ai' }); // 'Título contém "ai"'
 */
export function describeQueryTree(node: QueryASTNode): string {
  if (node.type === 'rule') return `${FIELD_NAMES[node.field]} ${OPERATOR_NAMES[node.operator]} "${node.value}"`;
  return `(${node.children.map(describeQueryTree).join(` ${node.logicalOperator} `)})`;
}

/**
 * The free bases plus every keyed base that has a key, selected when the page opens.
 *
 * Usage:
 *   setSelectedDbs(defaultDatabases({ scopus: 'k', wos: '' })); // ['openalex', 'crossref', 'scopus']
 */
export function defaultDatabases(keys: SearchApiKeys): string[] {
  return ['openalex', 'crossref', ...KEYED_DATABASES.filter((db) => keys[db])];
}

export type FinalQueries = { queries: Record<string, string> } | { invalidDatabase: string };

/**
 * The query to send to each selected base: its custom query if any, otherwise its automatic translation.
 * Reports the first base whose automatic translation is missing or invalid.
 *
 * Usage:
 *   const result = buildFinalQueries(['openalex'], {}, translations);
 *   if ('invalidDatabase' in result) showError(result.invalidDatabase);
 */
export function buildFinalQueries(
  selected: string[],
  customQueries: Record<string, string>,
  translations: DatabaseTranslationMap,
): FinalQueries {
  const queries: Record<string, string> = {};
  for (const dbId of selected) {
    const translation = translations[dbId];
    if (customQueries[dbId]) queries[dbId] = customQueries[dbId];
    else if (translation?.isValid) queries[dbId] = translation.query;
    else return { invalidDatabase: dbId };
  }
  return { queries };
}

/** A past search, ready to load into the search page. */
export interface RestoredSearch {
  state: SearchQueryState;
  sortBy?: QuerySort;
  limits?: SearchLimits;
  // Searches saved before the builder state was stored only have the query sent to each base.
  isLegacy: boolean;
}

const SEARCH_DATABASE_IDS = new Set(SEARCH_DATABASES.map((d) => d.id));
const QUERY_SORTS: ReadonlySet<string> = new Set<QuerySort>(['relevance', 'citations', 'date']);

function parseJsonObject(raw: string | null | undefined): Record<string, unknown> | null {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Old entries: each base's query becomes a custom query, and the builder starts empty.
function legacyQueryState(item: SearchHistoryItem): SearchQueryState | null {
  const translated = parseJsonObject(item.translated_queries) ?? {};
  const customQueries = Object.fromEntries(
    Object.entries(translated).filter(([db, q]) => SEARCH_DATABASE_IDS.has(db) && typeof q === 'string' && q),
  ) as Record<string, string>;
  const selectedDbs = Object.keys(customQueries);
  return selectedDbs.length ? { ast: EMPTY_QUERY, selectedDbs, customQueries } : null;
}

// Searches saved before pagination only have limit_val, the one limit then shared by every base.
function restoredLimits(state: SearchQueryState, item: SearchHistoryItem): SearchLimits | undefined {
  const saved = state.limits;
  if (saved && typeof saved.common === 'number' && saved.perBase && typeof saved.perBase === 'object') {
    return { common: saved.common, perBase: { ...saved.perBase } };
  }
  return item.limit_val ? { common: item.limit_val, perBase: {} } : undefined;
}

/**
 * Rebuilds the search page state from a history entry; null for entries that were not a
 * database search (imports, manual additions, batch PDF imports).
 *
 * Usage:
 *   const restored = restoreSearch(historyItem);
 *   if (restored) { setAst(restored.state.ast); setSelectedDbs(restored.state.selectedDbs); }
 */
export function restoreSearch(item: SearchHistoryItem): RestoredSearch | null {
  const stored = parseJsonObject(item.query_state) as SearchQueryState | null;
  const state = stored ?? legacyQueryState(item);
  if (!state) return null;
  return {
    state,
    sortBy: item.sort_by && QUERY_SORTS.has(item.sort_by) ? (item.sort_by as QuerySort) : undefined,
    limits: restoredLimits(state, item),
    isLegacy: !stored,
  };
}

/**
 * Drops keyed bases (Scopus, WoS) that have no API key now, e.g. when reopening an old search.
 *
 * Usage:
 *   usableDatabases(['openalex', 'scopus'], { scopus: '', wos: '' }); // ['openalex']
 */
export function usableDatabases(dbs: string[], keys: SearchApiKeys): string[] {
  return dbs.filter((db) => !KEYED_DATABASES.includes(db as keyof SearchApiKeys) || keys[db as keyof SearchApiKeys]);
}

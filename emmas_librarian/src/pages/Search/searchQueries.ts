import type { DatabaseTranslationMap, QueryASTNode, QueryField, QueryOperator } from '../../types';

export const SEARCH_DATABASES = [
  { id: 'openalex', label: 'OpenAlex' },
  { id: 'crossref', label: 'Crossref' },
  { id: 'scopus', label: 'Scopus' },
  { id: 'wos', label: 'Web of Science' },
];

export interface SearchApiKeys {
  scopus: string;
  wos: string;
}

/** Bases that need a configured API key before they can be selected. */
export const KEYED_DATABASES: ReadonlyArray<keyof SearchApiKeys> = ['scopus', 'wos'];

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

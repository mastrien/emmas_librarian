import { describe, it, expect } from 'vitest';
import {
  EMPTY_QUERY,
  buildFinalQueries,
  defaultDatabases,
  describeQueryTree,
  restoreSearch,
  usableDatabases,
  loadSearchApiKeys,
} from '../searchQueries';
import type { DatabaseTranslationMap, QueryASTNode, SearchHistoryItem } from '../../../types';

describe('describeQueryTree', () => {
  it('describes a rule in Portuguese', () => {
    expect(describeQueryTree({ type: 'rule', field: 'abstract', operator: 'not_contains', value: 'x' })).toBe(
      'Resumo não contém "x"',
    );
  });

  it('wraps groups in parentheses joined by their operator, recursively', () => {
    const tree: QueryASTNode = {
      type: 'group',
      logicalOperator: 'OR',
      children: [
        { type: 'rule', field: 'title', operator: 'exact', value: 'a' },
        {
          type: 'group',
          logicalOperator: 'AND',
          children: [
            { type: 'rule', field: 'authors', operator: 'contains', value: 'b' },
            { type: 'rule', field: 'all', operator: 'contains', value: 'c' },
          ],
        },
      ],
    };

    expect(describeQueryTree(tree)).toBe('(Título é exatamente "a" OR (Autores contém "b" AND Todos contém "c"))');
  });
});

describe('defaultDatabases', () => {
  it.each([
    [{ scopus: '', wos: '', ieee: '' }, ['openalex', 'crossref']],
    [{ scopus: 'k', wos: '', ieee: '' }, ['openalex', 'crossref', 'scopus']],
    [{ scopus: 'k', wos: 'k', ieee: '' }, ['openalex', 'crossref', 'scopus', 'wos']],
  ])('selects the free bases plus keyed ones with a key (%o)', (keys, expected) => {
    expect(defaultDatabases(keys)).toEqual(expected);
  });

  it('leaves the experimental IEEE Xplore unselected even with a key', () => {
    expect(defaultDatabases({ scopus: '', wos: '', ieee: 'k' })).toEqual(['openalex', 'crossref']);
  });
});

describe('buildFinalQueries', () => {
  const translations: DatabaseTranslationMap = {
    openalex: { isValid: true, query: 'oa' },
    wos: { isValid: false, query: '', error: 'bad' },
  };

  it('uses the translation unless a custom query overrides it', () => {
    expect(buildFinalQueries(['openalex', 'wos'], { wos: 'custom' }, translations)).toEqual({
      queries: { openalex: 'oa', wos: 'custom' },
    });
  });

  it('reports the first base with an invalid translation', () => {
    expect(buildFinalQueries(['openalex', 'wos'], {}, translations)).toEqual({ invalidDatabase: 'wos' });
  });

  it('reports a base whose translation has not arrived yet', () => {
    expect(buildFinalQueries(['crossref'], {}, translations)).toEqual({ invalidDatabase: 'crossref' });
  });

  it('ignores an empty custom query', () => {
    expect(buildFinalQueries(['openalex'], { openalex: '' }, translations)).toEqual({ queries: { openalex: 'oa' } });
  });
});

describe('restoreSearch', () => {
  const historyEntry = (overrides: Partial<SearchHistoryItem>): SearchHistoryItem => ({
    id: 1,
    unified_query: 'q',
    translated_queries: '{}',
    total_results: 0,
    results_breakdown: '{}',
    created_at: '2026-09-27',
    ...overrides,
  });
  const titleRule: QueryASTNode = { type: 'rule', field: 'title', operator: 'contains', value: 'ontologia' };

  it('brings back the builder tree, bases, custom queries, sort and limits of a saved search', () => {
    const state = {
      ast: titleRule,
      selectedDbs: ['openalex', 'wos'],
      customQueries: { wos: 'TI=x' },
      limits: { common: 2000, perBase: { wos: 500 } },
    };

    const restored = restoreSearch(
      historyEntry({ query_state: JSON.stringify(state), sort_by: 'citations', limit_val: 2000 }),
    );

    expect(restored).toEqual({ state, sortBy: 'citations', limits: state.limits, isLegacy: false });
  });

  // Before pagination one limit applied to every base: it becomes the common value.
  it('turns the single limit of a search saved before pagination into the common value', () => {
    const state = { ast: titleRule, selectedDbs: ['openalex'], customQueries: {} };

    const restored = restoreSearch(historyEntry({ query_state: JSON.stringify(state), limit_val: 25 }));

    expect(restored?.limits).toEqual({ common: 25, perBase: {} });
  });

  it('turns each base query of an older search into a custom query, with an empty builder', () => {
    const restored = restoreSearch(
      historyEntry({
        translated_queries: JSON.stringify({ openalex: 'title.search:x', wos: 'TI=x' }),
        sort_by: 'date',
      }),
    );

    expect(restored).toEqual({
      state: {
        ast: EMPTY_QUERY,
        selectedDbs: ['openalex', 'wos'],
        customQueries: { openalex: 'title.search:x', wos: 'TI=x' },
      },
      sortBy: 'date',
      limits: undefined,
      isLegacy: true,
    });
  });

  it.each([
    ['an import from another project', JSON.stringify({ import: 'Origem: Projeto ID 2' })],
    ['a manual addition', '{}'],
    ['a corrupted entry', '{not json'],
  ])('returns null for %s', (_label, translated) => {
    expect(restoreSearch(historyEntry({ translated_queries: translated }))).toBeNull();
  });

  it('ignores an unknown sort order', () => {
    const restored = restoreSearch(historyEntry({ translated_queries: '{"openalex":"x"}', sort_by: 'popularity' }));

    expect(restored?.sortBy).toBeUndefined();
  });
});

describe('usableDatabases', () => {
  it('keeps free bases and keyed bases that have a key', () => {
    expect(usableDatabases(['openalex', 'scopus', 'wos', 'ieee'], { scopus: 'k', wos: '', ieee: '' })).toEqual([
      'openalex',
      'scopus',
    ]);
  });
});

describe('loadSearchApiKeys', () => {
  it('reads the key setting of every keyed base, empty when missing', async () => {
    const stored: Record<string, string> = { scopus_api_key: 's', ieee_api_key: 'i' };

    const keys = await loadSearchApiKeys(async (key) => stored[key] ?? null);

    expect(keys).toEqual({ scopus: 's', wos: '', ieee: 'i' });
  });
});

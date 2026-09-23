import { describe, it, expect } from 'vitest';
import { buildFinalQueries, defaultDatabases, describeQueryTree } from '../searchQueries';
import type { DatabaseTranslationMap, QueryASTNode } from '../../../types';

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
    [{ scopus: '', wos: '' }, ['openalex', 'crossref']],
    [{ scopus: 'k', wos: '' }, ['openalex', 'crossref', 'scopus']],
    [{ scopus: 'k', wos: 'k' }, ['openalex', 'crossref', 'scopus', 'wos']],
  ])('selects the free bases plus keyed ones with a key (%o)', (keys, expected) => {
    expect(defaultDatabases(keys)).toEqual(expected);
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

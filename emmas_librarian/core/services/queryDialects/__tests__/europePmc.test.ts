import { describe, it, expect } from 'vitest';
import type { QueryASTNode, QueryField, QueryOperator } from '../../../../src/types';
import { toEuropePmcQuery } from '../europePmc';
import { translateWith } from '../shared';

const rule = (field: QueryField, operator: QueryOperator, value: string): QueryASTNode => ({
  type: 'rule',
  field,
  operator,
  value,
});
const group = (logicalOperator: 'AND' | 'OR', ...children: QueryASTNode[]): QueryASTNode => ({
  type: 'group',
  logicalOperator,
  children,
});

describe('toEuropePmcQuery', () => {
  // The builder's root is a group; with one rule, the query shown on the search page stays clean.
  it('translates a group with a single term without extra parentheses', () => {
    expect(toEuropePmcQuery(group('AND', rule('title', 'contains', 'diabetes')))).toBe('TITLE:(diabetes)');
  });

  it('maps fields and operators: words, phrase, exclusion', () => {
    expect(toEuropePmcQuery(rule('title', 'contains', 'machine learning'))).toBe('TITLE:(machine learning)');
    expect(toEuropePmcQuery(rule('abstract', 'exact', 'deep learning'))).toBe('ABSTRACT:"deep learning"');
    expect(toEuropePmcQuery(rule('authors', 'contains', 'smith'))).toBe('AUTH:(smith)');
    expect(toEuropePmcQuery(rule('all', 'contains', 'cancer'))).toBe('(cancer)');
    expect(toEuropePmcQuery(rule('title', 'not_contains', 'survey'))).toBe('NOT TITLE:(survey)');
  });

  it('nests groups and puts exclusions after the positive terms of an AND group', () => {
    const tree = group(
      'AND',
      rule('title', 'not_contains', 'survey'),
      group('OR', rule('title', 'contains', 'diabetes'), rule('abstract', 'exact', 'insulin resistance')),
    );

    expect(toEuropePmcQuery(tree)).toBe(
      '((TITLE:(diabetes)) OR (ABSTRACT:"insulin resistance")) AND NOT TITLE:(survey)',
    );
  });

  it('removes characters that would break the query syntax', () => {
    expect(toEuropePmcQuery(rule('title', 'exact', 'covid-19 "long" (sequelae): cohort'))).toBe(
      'TITLE:"covid-19 long sequelae cohort"',
    );
  });

  it.each([
    [group('OR', rule('title', 'contains', 'a'), rule('title', 'not_contains', 'b')), 'dentro de um grupo OU'],
    [group('AND', rule('title', 'not_contains', 'b')), 'ao menos um termo'],
    [rule('title', 'contains', '  '), 'preencha o termo'],
    [group('AND'), 'grupo está vazio'],
  ])('refuses a tree it cannot express (%#), explaining why', (tree, reason) => {
    const result = translateWith(toEuropePmcQuery, tree);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain(reason);
  });
});

import { describe, it, expect } from 'vitest';
import type { QueryASTNode, QueryField, QueryOperator } from '../../../../src/types';
import { toArxivQuery } from '../arxiv';
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

describe('toArxivQuery', () => {
  // The builder's root is a group; with one rule, the query shown on the search page stays clean.
  it('translates a group with a single term without extra parentheses', () => {
    expect(toArxivQuery(group('AND', rule('title', 'contains', 'diabetes')))).toBe('ti:diabetes');
  });

  it('maps fields, requires every word of "contém" and quotes "exato"', () => {
    expect(toArxivQuery(rule('title', 'contains', 'machine learning'))).toBe('(ti:machine AND ti:learning)');
    expect(toArxivQuery(rule('abstract', 'exact', 'insulin resistance'))).toBe('abs:"insulin resistance"');
    expect(toArxivQuery(rule('authors', 'contains', 'smith'))).toBe('au:smith');
    expect(toArxivQuery(rule('all', 'contains', 'cancer'))).toBe('all:cancer');
  });

  it('turns exclusions into ANDNOT after the other terms, and nests groups', () => {
    const tree = group(
      'AND',
      rule('title', 'not_contains', 'survey'),
      group('OR', rule('title', 'contains', 'diabetes'), rule('abstract', 'exact', 'insulin resistance')),
    );

    expect(toArxivQuery(tree)).toBe('((ti:diabetes) OR (abs:"insulin resistance")) ANDNOT ti:survey');
  });

  it.each([
    [rule('title', 'not_contains', 'survey'), 'precisa de outro termo'],
    [group('AND', rule('title', 'not_contains', 'b')), 'ao menos um termo'],
    [group('OR', rule('title', 'contains', 'a'), rule('title', 'not_contains', 'b')), 'dentro de um grupo OU'],
    [rule('title', 'contains', '"()"'), 'preencha o termo'],
  ])('refuses a tree arXiv cannot express (%#), explaining why', (tree, reason) => {
    const result = translateWith(toArxivQuery, tree);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain(reason);
  });
});

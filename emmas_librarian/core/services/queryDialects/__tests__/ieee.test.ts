import { describe, it, expect } from 'vitest';
import type { QueryASTNode, QueryField, QueryOperator } from '../../../../src/types';
import { toIeeeQuery } from '../ieee';
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

describe('toIeeeQuery', () => {
  // The builder's root is a group; with one rule, the query shown on the search page stays clean.
  it('translates a group with a single term without extra parentheses', () => {
    expect(toIeeeQuery(group('AND', rule('title', 'contains', 'diabetes')))).toBe('("Document Title":diabetes)');
  });

  it('maps fields to IEEE data fields, requires every word of "contém" and quotes "exato"', () => {
    expect(toIeeeQuery(rule('title', 'exact', 'smart grid'))).toBe('("Document Title":"smart grid")');
    expect(toIeeeQuery(rule('abstract', 'contains', 'power flow'))).toBe('(("Abstract":power) AND ("Abstract":flow))');
    expect(toIeeeQuery(rule('authors', 'contains', 'silva'))).toBe('("Authors":silva)');
    expect(toIeeeQuery(rule('all', 'contains', 'rfid'))).toBe('("All Metadata":rfid)');
  });

  it('puts exclusions as NOT after the other terms of an AND group and nests groups', () => {
    const tree = group(
      'AND',
      rule('title', 'not_contains', 'survey'),
      group('OR', rule('title', 'contains', 'rfid'), rule('all', 'exact', 'internet of things')),
    );

    expect(toIeeeQuery(tree)).toBe(
      '((("Document Title":rfid)) OR (("All Metadata":"internet of things"))) NOT ("Document Title":survey)',
    );
  });

  it.each([
    [rule('title', 'not_contains', 'survey'), 'precisa de outro termo'],
    [group('OR', rule('title', 'contains', 'a'), rule('title', 'not_contains', 'b')), 'dentro de um grupo OU'],
    [group('AND', rule('title', 'not_contains', 'b')), 'ao menos um termo'],
  ])('refuses a tree IEEE cannot express (%#), explaining why', (tree, reason) => {
    const result = translateWith(toIeeeQuery, tree);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain(reason);
  });
});

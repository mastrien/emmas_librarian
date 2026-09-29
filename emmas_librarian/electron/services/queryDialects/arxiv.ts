import type { QueryASTNode, QueryField, QueryGroupNode, QueryRuleNode } from '../../../src/types';
import { cleanTerm, positiveFirst } from './shared';

// arXiv search_query prefixes: ti (title), abs (abstract), au (author), all (every field).
const FIELD: Record<QueryField, string> = { all: 'all', title: 'ti', abstract: 'abs', authors: 'au' };

const isExclusion = (node: QueryASTNode) => node.type === 'rule' && node.operator === 'not_contains';

// arXiv matches field:word per word, so "contém" with several words requires each of them.
function ruleQuery(rule: QueryRuleNode): string {
  const term = cleanTerm(rule, 'arXiv');
  const field = FIELD[rule.field];
  if (rule.operator === 'exact') return `${field}:"${term}"`;
  const words = term.split(' ');
  return words.length === 1 ? `${field}:${term}` : `(${words.map((w) => `${field}:${w}`).join(' AND ')})`;
}

function andGroup(children: QueryASTNode[]): string {
  const ordered = positiveFirst(children, 'arXiv');
  return ordered
    .map((child, i) => {
      if (isExclusion(child)) return ` ANDNOT ${ruleQuery(child as QueryRuleNode)}`;
      return `${i === 0 ? '' : ' AND '}(${toArxivQuery(child)})`;
    })
    .join('');
}

function groupQuery(group: QueryGroupNode): string {
  if (group.children.length === 0) throw new Error('arXiv: o grupo está vazio.');
  if (group.logicalOperator === 'AND') return andGroup(group.children);
  // arXiv only has ANDNOT, a binary "and not": there is no way to say "a OR NOT b".
  if (group.children.some(isExclusion)) {
    throw new Error('arXiv não aceita "não contém" dentro de um grupo OU. Use o termo num grupo E.');
  }
  return group.children.map((child) => `(${toArxivQuery(child)})`).join(' OR ');
}

/**
 * The builder's tree as an arXiv search_query: ti/abs/au/all prefixes, "exato" as a quoted phrase,
 * "contém" as every word, and exclusions as ANDNOT after the other terms of an AND group.
 *
 * Usage:
 *   toArxivQuery({ type: 'rule', field: 'title', operator: 'contains', value: 'machine learning' }); // '(ti:machine AND ti:learning)'
 */
export function toArxivQuery(node: QueryASTNode): string {
  if (node.type === 'group') return groupQuery(node);
  if (node.operator === 'not_contains') {
    throw new Error('arXiv: "não contém" precisa de outro termo no mesmo grupo E (a busca usa ANDNOT).');
  }
  return ruleQuery(node);
}

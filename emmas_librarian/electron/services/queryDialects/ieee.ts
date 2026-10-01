import type { QueryASTNode, QueryField, QueryGroupNode, QueryRuleNode } from '../../../src/types';
import { cleanTerm, positiveFirst } from './shared';

// IEEE Xplore data fields, as in its command search: ("Document Title":term).
// The API documents AND/OR/NOT in querytext; the field form still needs a check with a real key.
const FIELD: Record<QueryField, string> = {
  all: 'All Metadata',
  title: 'Document Title',
  abstract: 'Abstract',
  authors: 'Authors',
};

const isExclusion = (node: QueryASTNode) => node.type === 'rule' && node.operator === 'not_contains';

function ruleQuery(rule: QueryRuleNode): string {
  const term = cleanTerm(rule, 'IEEE Xplore');
  const field = FIELD[rule.field];
  if (rule.operator === 'exact') return `("${field}":"${term}")`;
  const words = term.split(' ');
  if (words.length === 1) return `("${field}":${term})`;
  return `(${words.map((w) => `("${field}":${w})`).join(' AND ')})`;
}

// IEEE's NOT means "and not" (x NOT y), so exclusions follow the other terms of an AND group.
function andGroup(children: QueryASTNode[]): string {
  return positiveFirst(children, 'IEEE Xplore')
    .map((child, i) => {
      if (isExclusion(child)) return ` NOT ${ruleQuery(child as QueryRuleNode)}`;
      return `${i === 0 ? '' : ' AND '}(${toIeeeQuery(child)})`;
    })
    .join('');
}

function groupQuery(group: QueryGroupNode): string {
  if (group.children.length === 0) throw new Error('IEEE Xplore: o grupo está vazio.');
  // One term needs no parentheses: the builder's root group often holds a single rule.
  const [only] = group.children;
  if (group.children.length === 1 && !isExclusion(only)) return toIeeeQuery(only);
  if (group.logicalOperator === 'AND') return andGroup(group.children);
  if (group.children.some(isExclusion)) {
    throw new Error('IEEE Xplore não aceita "não contém" dentro de um grupo OU. Use o termo num grupo E.');
  }
  return group.children.map((child) => `(${toIeeeQuery(child)})`).join(' OR ');
}

/**
 * The builder's tree as an IEEE Xplore querytext: fields as ("Document Title":term), "exato" as a quoted
 * phrase, "contém" as every word, and exclusions as NOT after the other terms of an AND group.
 *
 * Usage:
 *   toIeeeQuery({ type: 'rule', field: 'title', operator: 'exact', value: 'smart grid' }); // '("Document Title":"smart grid")'
 */
export function toIeeeQuery(node: QueryASTNode): string {
  if (node.type === 'group') return groupQuery(node);
  if (node.operator === 'not_contains') {
    throw new Error('IEEE Xplore: "não contém" precisa de outro termo no mesmo grupo E (a busca usa NOT).');
  }
  return ruleQuery(node);
}

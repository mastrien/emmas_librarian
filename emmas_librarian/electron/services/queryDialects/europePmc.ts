import type { QueryASTNode, QueryField, QueryGroupNode, QueryRuleNode } from '../../../src/types';
import { cleanTerm, positiveFirst } from './shared';

// Europe PMC search syntax (Lucene-like): FIELD:(words) or FIELD:"phrase"; no field searches everywhere.
const FIELD: Record<QueryField, string | null> = { all: null, title: 'TITLE', abstract: 'ABSTRACT', authors: 'AUTH' };

function ruleQuery(rule: QueryRuleNode): string {
  const term = cleanTerm(rule, 'Europe PMC');
  const text = rule.operator === 'exact' ? `"${term}"` : `(${term})`;
  const field = FIELD[rule.field];
  return field ? `${field}:${text}` : text;
}

const isExclusion = (node: QueryASTNode) => node.type === 'rule' && node.operator === 'not_contains';

function groupQuery(group: QueryGroupNode): string {
  if (group.children.length === 0) throw new Error('Europe PMC: o grupo está vazio.');
  // "a OR NOT b" is a clause Lucene cannot match on its own; ask for AND instead of returning nothing.
  if (group.logicalOperator === 'OR' && group.children.some(isExclusion)) {
    throw new Error('Europe PMC não aceita "não contém" dentro de um grupo OU. Use o termo num grupo E.');
  }
  const children = group.logicalOperator === 'AND' ? positiveFirst(group.children, 'Europe PMC') : group.children;
  // An exclusion stays unwrapped: "(NOT b)" alone is a clause that matches nothing, "a AND NOT b" works.
  return children
    .map((child) => (isExclusion(child) ? toEuropePmcQuery(child) : `(${toEuropePmcQuery(child)})`))
    .join(` ${group.logicalOperator} `);
}

/**
 * The builder's tree as a Europe PMC query: "contém" searches the words, "exato" the phrase, "não contém"
 * becomes NOT, and fields map to TITLE, ABSTRACT and AUTH.
 *
 * Usage:
 *   toEuropePmcQuery({ type: 'rule', field: 'title', operator: 'exact', value: 'machine learning' }); // 'TITLE:"machine learning"'
 */
export function toEuropePmcQuery(node: QueryASTNode): string {
  if (node.type === 'group') return groupQuery(node);
  return node.operator === 'not_contains' ? `NOT ${ruleQuery(node)}` : ruleQuery(node);
}

import type { QueryASTNode, QueryRuleNode, QueryTranslationResult } from '../../../src/types';

/** Turns the builder's tree into one base's query string; throws with a readable reason when it cannot. */
export type QueryDialect = (ast: QueryASTNode) => string;

/**
 * Runs a dialect and reports failure the way the search page shows it (invalid, with the reason).
 *
 * Usage:
 *   translateWith(toEuropePmcQuery, ast); // { query: 'TITLE:"x"', isValid: true }
 */
export function translateWith(dialect: QueryDialect, ast: QueryASTNode): QueryTranslationResult {
  try {
    return { query: dialect(ast), isValid: true };
  } catch (e) {
    return { query: '', isValid: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * The rule's value without the characters that would break a Lucene-style query (quotes, parentheses,
 * colons, backslashes); throws when nothing is left, since an empty term matches nothing useful.
 *
 * Usage:
 *   cleanTerm({ ...rule, value: 'deep "learning"' }, 'Europe PMC'); // 'deep learning'
 */
export function cleanTerm(rule: QueryRuleNode, baseName: string): string {
  const value = rule.value
    .replace(/["():\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!value) throw new Error(`${baseName}: preencha o termo de busca.`);
  return value;
}

/**
 * The children of an AND group with the exclusions last, so bases that read NOT as "and not" get
 * "a AND NOT b" instead of a clause that starts with NOT; throws when every child is an exclusion.
 *
 * Usage:
 *   positiveFirst(group.children, 'arXiv');
 */
export function positiveFirst(children: QueryASTNode[], baseName: string): QueryASTNode[] {
  const isExclusion = (c: QueryASTNode) => c.type === 'rule' && c.operator === 'not_contains';
  const positives = children.filter((c) => !isExclusion(c));
  if (positives.length === 0)
    throw new Error(`${baseName}: a busca precisa de ao menos um termo que não seja "não contém".`);
  return [...positives, ...children.filter(isExclusion)];
}

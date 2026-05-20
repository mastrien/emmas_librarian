import { describe, it, expect } from 'vitest';
import { queryTranslator } from '../QueryTranslator';
import { QueryASTNode } from '../../types';

describe('QueryTranslator', () => {
  it('translates AST to Scopus, WoS, OpenAlex, and Crossref correctly', () => {
    const ast: QueryASTNode = {
      type: 'group',
      logicalOperator: 'AND',
      children: [
        { type: 'rule', field: 'title', operator: 'contains', value: 'test' }
      ]
    };
    
    const result = queryTranslator.translate(ast);
    
    expect(result.scopus.isValid).toBe(true);
    expect(result.scopus.query).toContain('TITLE("test")');

    expect(result.openalex.isValid).toBe(true);
    expect(result.openalex.query).toContain('title.search:test');
  });

  it('rejects invalid Crossref OR queries', () => {
    const ast: QueryASTNode = {
      type: 'group',
      logicalOperator: 'OR',
      children: [
        { type: 'rule', field: 'title', operator: 'contains', value: 'a' },
        { type: 'rule', field: 'abstract', operator: 'contains', value: 'b' }
      ]
    };
    
    const result = queryTranslator.translate(ast);
    expect(result.crossref.isValid).toBe(false);
  });
});

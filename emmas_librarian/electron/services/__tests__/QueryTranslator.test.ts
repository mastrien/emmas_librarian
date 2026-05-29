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

  it('translates exact and not_contains operators correctly', () => {
    const ast: QueryASTNode = {
      type: 'group',
      logicalOperator: 'AND',
      children: [
        { type: 'rule', field: 'authors', operator: 'exact', value: 'Smith' },
        { type: 'rule', field: 'abstract', operator: 'not_contains', value: 'rat' }
      ]
    };

    const result = queryTranslator.translate(ast);
    expect(result.scopus.query).toContain('(AUTH({Smith})) AND (NOT ABS("rat"))');
    expect(result.wos.query).toContain('(AU="Smith") AND (NOT AB="rat")');
    expect(result.openalex.query).toContain('author.search:Smith,abstract.search:!rat');
    expect(result.crossref.isValid).toBe(false); // Crossref doesn't support NOT
  });

  it('handles OpenAlex OR logic correctly', () => {
    // Valid: same field
    const validAst: QueryASTNode = {
      type: 'group',
      logicalOperator: 'OR',
      children: [
        { type: 'rule', field: 'title', operator: 'contains', value: 'cat' },
        { type: 'rule', field: 'title', operator: 'not_contains', value: 'dog' }
      ]
    };
    expect(queryTranslator.translate(validAst).openalex.query).toBe('title.search:cat|!dog');

    // Invalid: different fields
    const invalidAst: QueryASTNode = {
      type: 'group',
      logicalOperator: 'OR',
      children: [
        { type: 'rule', field: 'title', operator: 'contains', value: 'cat' },
        { type: 'rule', field: 'abstract', operator: 'contains', value: 'dog' }
      ]
    };
    expect(queryTranslator.translate(invalidAst).openalex.isValid).toBe(false);
  });

  it('handles empty groups safely', () => {
    const emptyAst: QueryASTNode = { type: 'group', logicalOperator: 'AND', children: [] };
    const res = queryTranslator.translate(emptyAst);
    expect(res.scopus.query).toBe('');
    expect(res.wos.query).toBe('');
    expect(res.openalex.query).toBe('');
    expect(res.crossref.query).toBe('');
  });
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const QueryTranslator_1 = require("../QueryTranslator");
(0, vitest_1.describe)('QueryTranslator', () => {
    (0, vitest_1.it)('translates AST to Scopus, WoS, OpenAlex, and Crossref correctly', () => {
        const ast = {
            type: 'group',
            logicalOperator: 'AND',
            children: [
                { type: 'rule', field: 'title', operator: 'contains', value: 'test' }
            ]
        };
        const result = QueryTranslator_1.queryTranslator.translate(ast);
        (0, vitest_1.expect)(result.scopus.isValid).toBe(true);
        (0, vitest_1.expect)(result.scopus.query).toContain('TITLE("test")');
        (0, vitest_1.expect)(result.openalex.isValid).toBe(true);
        (0, vitest_1.expect)(result.openalex.query).toContain('title.search:test');
    });
    (0, vitest_1.it)('rejects invalid Crossref OR queries', () => {
        const ast = {
            type: 'group',
            logicalOperator: 'OR',
            children: [
                { type: 'rule', field: 'title', operator: 'contains', value: 'a' },
                { type: 'rule', field: 'abstract', operator: 'contains', value: 'b' }
            ]
        };
        const result = QueryTranslator_1.queryTranslator.translate(ast);
        (0, vitest_1.expect)(result.crossref.isValid).toBe(false);
    });
});

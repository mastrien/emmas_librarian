"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const QueryTranslator_1 = require("../QueryTranslator");
(0, vitest_1.describe)('QueryTranslator', () => {
    const translator = new QueryTranslator_1.QueryTranslator();
    (0, vitest_1.it)('translates title and year to OpenAlex format', () => {
        const blocks = [
            { id: '1', field: 'title', type: 'contains', value: 'machine learning' },
            { id: '2', field: 'year', type: 'greater_than', value: '2020' }
        ];
        const result = translator.toOpenAlex(blocks);
        (0, vitest_1.expect)(result).toBe('title.search:machine learning,publication_year:>2020');
    });
    (0, vitest_1.it)('translates title and year to Crossref format', () => {
        const blocks = [
            { id: '1', field: 'title', type: 'contains', value: 'machine learning' },
            { id: '2', field: 'year', type: 'greater_than', value: '2020' }
        ];
        const result = translator.toCrossref(blocks);
        (0, vitest_1.expect)(result['query.title']).toBe('machine learning');
        (0, vitest_1.expect)(result['filter']).toBe('from-pub-date:2021');
    });
});

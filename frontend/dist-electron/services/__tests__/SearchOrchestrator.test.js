"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const SearchOrchestrator_1 = require("../SearchOrchestrator");
const QueryTranslator_1 = require("../QueryTranslator");
const ApiIntegrator_1 = require("../ApiIntegrator");
const DatabaseManager_1 = require("../../database/DatabaseManager");
(0, vitest_1.describe)('SearchOrchestrator', () => {
    let db;
    let orchestrator;
    let api;
    (0, vitest_1.beforeEach)(() => {
        db = new DatabaseManager_1.DatabaseManager(':memory:');
        const translator = new QueryTranslator_1.QueryTranslator();
        api = new ApiIntegrator_1.ApiIntegrator();
        orchestrator = new SearchOrchestrator_1.SearchOrchestrator(db, translator, api);
    });
    (0, vitest_1.it)('deduplicates articles and merges sources', async () => {
        const proj = db.createProject('Test');
        const item1 = {
            doi: '10.123/abc', title: 'Test Article', source_databases: ['OpenAlex'], csl_json: {}
        };
        const item2 = {
            doi: '10.123/abc', title: 'Test Article', source_databases: ['Crossref'], csl_json: {}
        };
        vitest_1.vi.spyOn(api, 'searchOpenAlex').mockResolvedValue([item1]);
        vitest_1.vi.spyOn(api, 'searchCrossref').mockResolvedValue([item2]);
        const res = await orchestrator.searchAndPersist(proj.id, { openalex: 'filter=title.search:test' }, 100, 'relevance', 'title contains "test"');
        (0, vitest_1.expect)(res.savedCount).toBe(1);
        const articles = db.getArticlesByProject(proj.id);
        (0, vitest_1.expect)(articles).toHaveLength(1);
        (0, vitest_1.expect)(articles[0].source_databases).toBe('["OpenAlex","Crossref"]');
    });
});

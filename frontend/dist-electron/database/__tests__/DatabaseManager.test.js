"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const DatabaseManager_1 = require("../DatabaseManager");
(0, vitest_1.describe)('DatabaseManager', () => {
    let dbManager;
    (0, vitest_1.beforeEach)(() => {
        dbManager = new DatabaseManager_1.DatabaseManager(':memory:');
    });
    (0, vitest_1.afterEach)(() => {
        dbManager.close();
    });
    (0, vitest_1.it)('creates and retrieves a project', () => {
        const proj = dbManager.createProject('Test Project');
        (0, vitest_1.expect)(proj.id).toBeGreaterThan(0);
        (0, vitest_1.expect)(proj.name).toBe('Test Project');
        const retrieved = dbManager.getProject(proj.id);
        (0, vitest_1.expect)(retrieved).toEqual(proj);
        const all = dbManager.getAllProjects();
        (0, vitest_1.expect)(all).toHaveLength(1);
        (0, vitest_1.expect)(all[0].id).toBe(proj.id);
    });
    (0, vitest_1.it)('saves and retrieves articles', () => {
        const proj = dbManager.createProject('Proj1');
        const articleId = dbManager.saveArticle(proj.id, {
            title: 'Test Article',
            source_query: 'test',
            source_databases: '["OpenAlex"]',
            csl_json: '{}'
        });
        const article = dbManager.getArticle(articleId);
        (0, vitest_1.expect)(article).toBeDefined();
        (0, vitest_1.expect)(article?.title).toBe('Test Article');
        (0, vitest_1.expect)(article?.project_id).toBe(proj.id);
        const projectArticles = dbManager.getArticlesByProject(proj.id);
        (0, vitest_1.expect)(projectArticles).toHaveLength(1);
        dbManager.updateArticleFilePath(articleId, '/test/path.pdf');
        const updated = dbManager.getArticle(articleId);
        (0, vitest_1.expect)(updated?.local_file_path).toBe('/test/path.pdf');
    });
    (0, vitest_1.it)('manages annotations and highlights', () => {
        const proj = dbManager.createProject('Proj1');
        const articleId = dbManager.saveArticle(proj.id, {
            title: 'Test', source_query: '', source_databases: '[]', csl_json: '{}'
        });
        const annId = dbManager.saveAnnotation(articleId, 'Test Annotation');
        const anns = dbManager.getAnnotations(articleId);
        (0, vitest_1.expect)(anns).toHaveLength(1);
        (0, vitest_1.expect)(anns[0].content_markdown).toBe('Test Annotation');
        const hlId = dbManager.saveHighlight(articleId, '#ff0', '{}', annId);
        const highlights = dbManager.getHighlights(articleId);
        (0, vitest_1.expect)(highlights).toHaveLength(1);
        (0, vitest_1.expect)(highlights[0].color).toBe('#ff0');
        (0, vitest_1.expect)(highlights[0].comment).toBe('Test Annotation'); // from LEFT JOIN
    });
    (0, vitest_1.it)('saves search history, associates with articles, and reverts searches correctly', () => {
        const proj = dbManager.createProject('Revert Search Project');
        // Save search history
        const searchId = dbManager.saveSearchHistory(proj.id, 'test unified query', { openalex: 'test translated query' }, 1, { openalex: { count: 1 } });
        (0, vitest_1.expect)(searchId).toBeGreaterThan(0);
        // Save article with that searchId
        const articleId = dbManager.saveArticle(proj.id, {
            title: 'Article 1',
            source_query: 'test',
            source_databases: '["openalex"]',
            csl_json: '{}',
            search_id: searchId
        });
        const article = dbManager.getArticle(articleId);
        (0, vitest_1.expect)(article?.search_id).toBe(searchId);
        // Revert the search
        dbManager.revertSearch(searchId);
        // Verify search is deleted from history
        const history = dbManager.getSearchHistory(proj.id);
        (0, vitest_1.expect)(history).toHaveLength(0);
        // Verify article is deleted
        const articleDeleted = dbManager.getArticle(articleId);
        (0, vitest_1.expect)(articleDeleted).toBeUndefined();
    });
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchOrchestrator = void 0;
class SearchOrchestrator {
    db;
    translator;
    api;
    constructor(db, translator, api) {
        this.db = db;
        this.translator = translator;
        this.api = api;
    }
    async searchAndPersist(projectId, queryMap, limit, sortBy, unifiedQuery) {
        // Fetch API keys from settings
        const scopusKey = this.db.getSetting('scopus_api_key') || '';
        const wosKey = this.db.getSetting('wos_api_key') || '';
        const activeIntegrators = [];
        // Select integrators based on the queryMap provided by the frontend.
        // If a database is missing in the map, it means the user deactivated it.
        // limit is applied per-database (each base fetches up to 'limit' articles)
        if (queryMap.openalex)
            activeIntegrators.push({ name: 'openalex', promise: this.api.searchOpenAlex(queryMap.openalex, sortBy, limit) });
        if (queryMap.crossref)
            activeIntegrators.push({ name: 'crossref', promise: this.api.searchCrossref(queryMap.crossref, sortBy, limit) });
        if (queryMap.scopus)
            activeIntegrators.push({ name: 'scopus', promise: this.api.searchScopus(queryMap.scopus, scopusKey, sortBy, limit) });
        if (queryMap.wos)
            activeIntegrators.push({ name: 'wos', promise: this.api.searchWoS(queryMap.wos, wosKey, sortBy, limit) });
        const breakdown = {};
        const resultsArray = await Promise.all(activeIntegrators.map(ai => ai.promise
            .then(res => {
            breakdown[ai.name] = { count: res.length };
            return res;
        })
            .catch(err => {
            breakdown[ai.name] = { count: 0, error: err.message || "Erro desconhecido" };
            return [];
        })));
        const combinedResults = resultsArray.flat();
        const deduplicated = this.deduplicate(combinedResults);
        let savedCount = 0;
        for (const article of deduplicated) {
            this.db.saveArticle(projectId, {
                doi: article.doi,
                title: article.title,
                authors: article.authors,
                year: article.year,
                abstract: article.abstract,
                author_keywords: article.authorKeywords,
                index_keywords: article.indexKeywords,
                journal: article.journal,
                volume: article.volume,
                issue: article.issue,
                pages: article.pages,
                affiliations: article.affiliations,
                references_list: article.references,
                document_type: article.documentType,
                issn: article.issn,
                citation_count: article.citationCount,
                source_query: JSON.stringify(queryMap),
                source_databases: JSON.stringify(article.source_databases),
                csl_json: JSON.stringify(article.csl_json)
            });
            savedCount++;
        }
        // Save to history
        this.db.saveSearchHistory(projectId, unifiedQuery, queryMap, deduplicated.length, breakdown);
        const projectArticles = this.db.getArticlesByProject(projectId);
        return { savedCount, articles: projectArticles, breakdown };
    }
    deduplicate(results) {
        const seenDoi = new Map();
        const seenTitle = new Map();
        const deduplicated = [];
        for (const item of results) {
            const doi = item.doi;
            const title = (item.title || "").toLowerCase().trim();
            let existingIdx;
            if (doi && seenDoi.has(doi)) {
                existingIdx = seenDoi.get(doi);
            }
            else if (title && seenTitle.has(title)) {
                existingIdx = seenTitle.get(title);
            }
            if (existingIdx !== undefined) {
                const existing = deduplicated[existingIdx];
                const newSource = item.source_databases[0];
                if (!existing.source_databases.includes(newSource)) {
                    existing.source_databases.push(newSource);
                }
            }
            else {
                const idx = deduplicated.length;
                deduplicated.push(item);
                if (doi)
                    seenDoi.set(doi, idx);
                if (title)
                    seenTitle.set(title, idx);
            }
        }
        return deduplicated;
    }
}
exports.SearchOrchestrator = SearchOrchestrator;

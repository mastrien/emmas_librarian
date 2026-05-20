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
    async executeSearch(projectId, queryBlocks, limit = 100) {
        const openalexFilter = this.translator.toOpenAlex(queryBlocks);
        const crossrefParams = this.translator.toCrossref(queryBlocks);
        // Fetch results
        const [oaResults, crResults] = await Promise.all([
            this.api.searchOpenAlex(openalexFilter),
            this.api.searchCrossref(crossrefParams)
        ]);
        const combinedResults = [...oaResults.slice(0, limit), ...crResults.slice(0, limit)];
        const deduplicated = this.deduplicate(combinedResults);
        let savedCount = 0;
        for (const article of deduplicated) {
            this.db.saveArticle(projectId, {
                doi: article.doi,
                title: article.title,
                authors: article.authors,
                year: article.year,
                source_query: JSON.stringify(queryBlocks),
                source_databases: JSON.stringify(article.source_databases),
                csl_json: JSON.stringify(article.csl_json)
            });
            savedCount++;
        }
        const projectArticles = this.db.getArticlesByProject(projectId);
        return { savedCount, articles: projectArticles };
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

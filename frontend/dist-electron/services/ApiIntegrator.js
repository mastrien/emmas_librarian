"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiIntegrator = void 0;
class ApiIntegrator {
    OPENALEX_URL = "https://api.openalex.org/works";
    CROSSREF_URL = "https://api.crossref.org/works";
    SCOPUS_URL = "https://api.elsevier.com/content/search/scopus";
    WOS_URL = "https://api.clarivate.com/api/wos-starter/v1/search";
    async searchOpenAlex(filterStr, sortBy) {
        try {
            const url = new URL(this.OPENALEX_URL);
            // If filterStr contains 'filter=', extract just the value
            let cleanFilter = filterStr;
            if (filterStr.includes('filter=')) {
                const parts = filterStr.split('filter=');
                cleanFilter = parts[parts.length - 1];
            }
            if (cleanFilter)
                url.searchParams.append("filter", cleanFilter);
            if (sortBy === 'citations')
                url.searchParams.append("sort", "cited_by_count:desc");
            else if (sortBy === 'date')
                url.searchParams.append("sort", "publication_date:desc");
            else
                url.searchParams.append("sort", "relevance_score:desc");
            const response = await fetch(url.toString());
            if (response.ok) {
                const data = await response.json();
                const results = data.results || [];
                return results.map((item) => this.normalizeOpenAlex(item));
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Erro ${response.status} no OpenAlex`);
        }
        catch (e) {
            console.error("OpenAlex fetch error", e);
            throw e;
        }
    }
    async searchCrossref(queryStr, sortBy) {
        try {
            // Use URLSearchParams to parse queryStr and add sorting
            const url = new URL(this.CROSSREF_URL);
            const searchParams = new URLSearchParams(queryStr);
            if (sortBy === 'citations') {
                searchParams.set('sort', 'is-referenced-by-count');
                searchParams.set('order', 'desc');
            }
            else if (sortBy === 'date') {
                searchParams.set('sort', 'published');
                searchParams.set('order', 'desc');
            }
            else if (!searchParams.has('sort')) {
                searchParams.set('sort', 'score');
            }
            url.search = searchParams.toString();
            const response = await fetch(url.toString());
            if (response.ok) {
                const data = await response.json();
                const items = data.message?.items || [];
                return items.map((item) => this.normalizeCrossref(item));
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Erro ${response.status} no Crossref`);
        }
        catch (e) {
            console.error("Crossref fetch error", e);
            throw e;
        }
    }
    async searchScopus(queryStr, apiKey, sortBy) {
        if (!apiKey)
            return [];
        try {
            const url = new URL(this.SCOPUS_URL);
            url.searchParams.append("query", queryStr);
            if (sortBy === 'citations')
                url.searchParams.append("sort", "citedby-count");
            else if (sortBy === 'date')
                url.searchParams.append("sort", "pubyear");
            else
                url.searchParams.append("sort", "relevancy");
            const response = await fetch(url.toString(), {
                headers: { "X-ELS-APIKey": apiKey, "Accept": "application/json" }
            });
            if (response.ok) {
                const data = await response.json();
                const entries = data["search-results"]?.entry || [];
                return entries.map((item) => this.normalizeScopus(item));
            }
            if (response.status === 401)
                throw new Error("Chave de API inválida ou expirada");
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData["service-error"]?.status?.statusText || `Erro ${response.status} no Scopus`);
        }
        catch (e) {
            console.error("Scopus fetch error", e);
            throw e;
        }
    }
    async searchWoS(queryStr, apiKey, sortBy) {
        if (!apiKey)
            return [];
        try {
            const url = new URL(this.WOS_URL);
            url.searchParams.append("dbId", "WOK");
            url.searchParams.append("usrQuery", queryStr);
            url.searchParams.append("count", "50");
            url.searchParams.append("firstRecord", "1");
            // Starter API sorting: relevance, timesCited, publicationDate
            if (sortBy === 'citations')
                url.searchParams.append("sortField", "timesCited+D");
            else if (sortBy === 'date')
                url.searchParams.append("sortField", "publicationDate+D");
            else
                url.searchParams.append("sortField", "relevance");
            const response = await fetch(url.toString(), {
                headers: { "X-ApiKey": apiKey }
            });
            if (response.ok) {
                const data = await response.json();
                const hits = data.hits || [];
                return hits.map((item) => this.normalizeWoS(item));
            }
            if (response.status === 401)
                throw new Error("Chave de API inválida ou expirada");
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Erro ${response.status} no Web of Science`);
        }
        catch (e) {
            console.error("WoS fetch error", e);
            throw e;
        }
    }
    normalizeOpenAlex(raw) {
        let doi = raw.doi || "";
        if (doi && doi.includes("doi.org/")) {
            doi = doi.split("doi.org/").pop() || doi;
        }
        const authors = [];
        for (const auth of (raw.authorships || [])) {
            const name = auth.author?.display_name || "";
            if (name) {
                const parts = name.split(" ");
                if (parts.length > 1) {
                    authors.push({ given: parts.slice(0, -1).join(" "), family: parts[parts.length - 1] });
                }
                else {
                    authors.push({ family: name });
                }
            }
        }
        const year = raw.publication_year;
        const cslJson = {
            id: raw.id,
            type: "article-journal",
            title: raw.title,
            DOI: doi,
            issued: { "date-parts": [[year]] },
            author: authors
        };
        return {
            doi,
            title: raw.title || "",
            authors: authors.map((a) => `${a.given || ''} ${a.family || ''}`.trim()).join(", "),
            year: year,
            source_databases: ["OpenAlex"],
            csl_json: cslJson
        };
    }
    normalizeCrossref(raw) {
        const title = (raw.title && raw.title.length > 0) ? raw.title[0] : "";
        const year = raw.issued?.["date-parts"]?.[0]?.[0];
        const authors = (raw.author || []).map((a) => `${a.given || ''} ${a.family || ''}`.trim()).join(", ");
        const cslJson = {
            id: raw.DOI,
            type: "article-journal",
            title: title,
            DOI: raw.DOI,
            issued: raw.issued,
            author: raw.author || []
        };
        return {
            doi: raw.DOI,
            title: title,
            authors: authors,
            year: year,
            source_databases: ["Crossref"],
            csl_json: cslJson
        };
    }
    normalizeScopus(raw) {
        const doi = raw["prism:doi"] || "";
        const title = raw["dc:title"] || "";
        const authors = raw["dc:creator"] || "";
        const date = raw["prism:coverDate"] || "";
        const year = date ? parseInt(date.split("-")[0]) : undefined;
        return {
            doi,
            title,
            authors,
            year,
            source_databases: ["Scopus"],
            csl_json: {
                id: doi || raw["dc:identifier"],
                type: "article-journal",
                title,
                DOI: doi,
                issued: year ? { "date-parts": [[year]] } : undefined,
                author: [{ family: authors }]
            }
        };
    }
    normalizeWoS(raw) {
        const doi = raw.identifiers?.doi || "";
        const title = raw.title || "";
        const authors = (raw.names?.authors || []).map((a) => a.displayName).join(", ");
        const year = raw.publication?.year;
        return {
            doi,
            title,
            authors,
            year,
            source_databases: ["Web of Science"],
            csl_json: {
                id: doi || raw.uid,
                type: "article-journal",
                title,
                DOI: doi,
                issued: year ? { "date-parts": [[year]] } : undefined,
                author: (raw.names?.authors || []).map((a) => ({ family: a.displayName }))
            }
        };
    }
}
exports.ApiIntegrator = ApiIntegrator;

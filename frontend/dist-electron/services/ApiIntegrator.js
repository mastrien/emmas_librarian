"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiIntegrator = void 0;
class ApiIntegrator {
    OPENALEX_URL = "https://api.openalex.org/works";
    CROSSREF_URL = "https://api.crossref.org/works";
    async searchOpenAlex(filterStr) {
        try {
            const url = new URL(this.OPENALEX_URL);
            if (filterStr)
                url.searchParams.append("filter", filterStr);
            const response = await fetch(url.toString());
            if (response.ok) {
                const data = await response.json();
                const results = data.results || [];
                return results.map((item) => this.normalizeOpenAlex(item));
            }
            return [];
        }
        catch (e) {
            console.error("OpenAlex fetch error", e);
            return [];
        }
    }
    async searchCrossref(params) {
        try {
            const url = new URL(this.CROSSREF_URL);
            for (const [key, val] of Object.entries(params)) {
                url.searchParams.append(key, val);
            }
            const response = await fetch(url.toString());
            if (response.ok) {
                const data = await response.json();
                const items = data.message?.items || [];
                return items.map((item) => this.normalizeCrossref(item));
            }
            return [];
        }
        catch (e) {
            console.error("Crossref fetch error", e);
            return [];
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
}
exports.ApiIntegrator = ApiIntegrator;

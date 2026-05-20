"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryTranslator = exports.QueryTranslator = void 0;
class QueryTranslator {
    translate(ast) {
        return {
            scopus: this.translateToScopus(ast),
            wos: this.translateToWoS(ast),
            openalex: this.translateToOpenAlex(ast),
            crossref: this.translateToCrossref(ast)
        };
    }
    // --- SCOPUS ---
    translateToScopus(node) {
        try {
            const query = this.scopusVisit(node);
            return { query, isValid: true };
        }
        catch (e) {
            return { query: '', isValid: false, error: e.message };
        }
    }
    scopusVisit(node) {
        if (node.type === 'rule') {
            const fieldMap = {
                all: 'ALL',
                title: 'TITLE',
                abstract: 'ABS',
                authors: 'AUTH'
            };
            const field = fieldMap[node.field];
            const val = node.operator === 'exact' ? `{${node.value}}` : `"${node.value}"`;
            if (node.operator === 'not_contains') {
                return `AND NOT ${field}(${val})`; // This is a bit hacky, normally NOT is a unary operator on the rule
                // A better way is to just do NOT field(val). Scopus uses AND NOT. Let's just use NOT field(val).
            }
            return `${field}(${val})`;
        }
        else {
            const groupNode = node;
            if (groupNode.children.length === 0)
                return '';
            const parts = groupNode.children.map(child => {
                let childStr = this.scopusVisit(child);
                if (child.type === 'rule' && child.operator === 'not_contains') {
                    // If it's a NOT rule inside an AND/OR group, Scopus prefers AND NOT.
                    // But to be safe, standard boolean is `NOT x`.
                    childStr = `NOT ${this.scopusRuleWithoutNot(child)}`;
                }
                return `(${childStr})`;
            });
            return parts.join(` ${groupNode.logicalOperator} `);
        }
    }
    scopusRuleWithoutNot(node) {
        const fieldMap = { all: 'ALL', title: 'TITLE', abstract: 'ABS', authors: 'AUTH' };
        const val = node.operator === 'exact' ? `{${node.value}}` : `"${node.value}"`;
        return `${fieldMap[node.field]}(${val})`;
    }
    // --- Web of Science (WoS) ---
    translateToWoS(node) {
        try {
            const query = this.wosVisit(node);
            return { query, isValid: true };
        }
        catch (e) {
            return { query: '', isValid: false, error: e.message };
        }
    }
    wosVisit(node) {
        if (node.type === 'rule') {
            const fieldMap = {
                all: 'TS',
                title: 'TI',
                abstract: 'AB',
                authors: 'AU'
            };
            const field = fieldMap[node.field];
            const val = `"${node.value}"`;
            if (node.operator === 'not_contains') {
                return `NOT ${field}=${val}`;
            }
            return `${field}=${val}`;
        }
        else {
            const groupNode = node;
            if (groupNode.children.length === 0)
                return '';
            const parts = groupNode.children.map(child => `(${this.wosVisit(child)})`);
            return parts.join(` ${groupNode.logicalOperator} `);
        }
    }
    // --- OpenAlex ---
    // OpenAlex format: filter=title.search:cat|dog,abstract.search:mouse
    translateToOpenAlex(node) {
        try {
            const query = this.openalexVisit(node);
            return { query, isValid: true };
        }
        catch (e) {
            return { query: '', isValid: false, error: e.message };
        }
    }
    openalexVisit(node) {
        if (node.type === 'rule') {
            const fieldMap = {
                all: 'default.search',
                title: 'title.search',
                abstract: 'abstract.search',
                authors: 'author.search'
            };
            const field = fieldMap[node.field];
            const val = node.value.replace(/,/g, '').replace(/\|/g, ''); // strip special chars
            if (node.operator === 'not_contains') {
                return `${field}:!${val}`;
            }
            return `${field}:${val}`;
        }
        else {
            const groupNode = node;
            if (groupNode.children.length === 0)
                return '';
            if (groupNode.logicalOperator === 'AND') {
                // AND in OpenAlex is comma-separated
                const parts = groupNode.children.map(child => this.openalexVisit(child));
                return parts.join(',');
            }
            else {
                // OR in OpenAlex is pipe |
                // BUT it only works if all children are rules targeting the EXACT SAME field.
                const isAllRules = groupNode.children.every(c => c.type === 'rule');
                if (!isAllRules) {
                    throw new Error('OpenAlex não suporta grupos OR com subgrupos aninhados.');
                }
                const rules = groupNode.children;
                const firstField = rules[0].field;
                const sameField = rules.every(r => r.field === firstField);
                if (!sameField) {
                    throw new Error('OpenAlex não suporta operador OR entre campos diferentes.');
                }
                // They are all same field!
                const fieldMap = { all: 'default.search', title: 'title.search', abstract: 'abstract.search', authors: 'author.search' };
                const mappedField = fieldMap[firstField];
                const vals = rules.map(r => r.operator === 'not_contains' ? `!${r.value}` : r.value);
                return `${mappedField}:${vals.join('|')}`;
            }
        }
    }
    // --- Crossref ---
    // Crossref format: query.title=cat&query.author=dog
    translateToCrossref(node) {
        try {
            const query = this.crossrefVisit(node);
            return { query, isValid: true };
        }
        catch (e) {
            return { query: '', isValid: false, error: e.message };
        }
    }
    crossrefVisit(node) {
        const params = this.crossrefCollect(node);
        const parts = [];
        for (const [key, values] of Object.entries(params)) {
            parts.push(`${key}=${encodeURIComponent(values.join(' '))}`);
        }
        return parts.join('&');
    }
    crossrefCollect(node) {
        const params = {};
        if (node.type === 'rule') {
            const fieldMap = {
                all: 'query',
                title: 'query.title',
                abstract: 'query',
                authors: 'query.author'
            };
            if (node.operator === 'not_contains') {
                throw new Error('Crossref não suporta exclusão (NOT).');
            }
            const field = fieldMap[node.field];
            params[field] = [node.value];
        }
        else {
            const groupNode = node;
            if (groupNode.logicalOperator === 'OR') {
                throw new Error('Crossref não suporta operador OR lógico entre campos diferentes.');
            }
            for (const child of groupNode.children) {
                const childParams = this.crossrefCollect(child);
                for (const [key, values] of Object.entries(childParams)) {
                    if (!params[key])
                        params[key] = [];
                    params[key].push(...values);
                }
            }
        }
        return params;
    }
}
exports.QueryTranslator = QueryTranslator;
exports.queryTranslator = new QueryTranslator();

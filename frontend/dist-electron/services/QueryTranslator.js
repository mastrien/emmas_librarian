"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryTranslator = void 0;
class QueryTranslator {
    toOpenAlex(queryBlocks) {
        const filters = [];
        for (const block of queryBlocks) {
            if (block.field === 'title') {
                filters.push(`title.search:${block.value}`);
            }
            else if (block.field === 'year') {
                if (block.type === 'greater_than') {
                    filters.push(`publication_year:>${block.value}`);
                }
                else if (block.type === 'less_than') {
                    filters.push(`publication_year:<${block.value}`);
                }
                else {
                    filters.push(`publication_year:${block.value}`);
                }
            }
        }
        return filters.join(',');
    }
    toCrossref(queryBlocks) {
        const params = {};
        const filters = [];
        for (const block of queryBlocks) {
            if (block.field === 'title') {
                params['query.title'] = block.value;
            }
            else if (block.field === 'year') {
                if (block.type === 'equals') {
                    filters.push(`from-pub-date:${block.value}`);
                    filters.push(`until-pub-date:${block.value}`);
                }
                else if (block.type === 'greater_than') {
                    filters.push(`from-pub-date:${parseInt(block.value) + 1}`);
                }
                else if (block.type === 'less_than') {
                    filters.push(`until-pub-date:${parseInt(block.value) - 1}`);
                }
            }
        }
        if (filters.length > 0) {
            params['filter'] = filters.join(',');
        }
        return params;
    }
}
exports.QueryTranslator = QueryTranslator;

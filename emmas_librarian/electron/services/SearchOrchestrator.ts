import { DatabaseAdapter } from '../database/DatabaseAdapter';
import { QueryTranslator } from './QueryTranslator';
import { ApiIntegrator } from './ApiIntegrator';
import { QueryBlock, NormalizedArticle } from './types';
import { Article } from '../../src/types';

export class SearchOrchestrator {
  constructor(
    private db: DatabaseAdapter,
    private translator: QueryTranslator,
    private api: ApiIntegrator,
  ) {}

  public async searchAndPersist(
    projectId: number,
    queryMap: Record<string, string>,
    limit: number,
    sortBy: 'relevance' | 'citations' | 'date',
    unifiedQuery: string,
  ): Promise<{
    savedCount: number;
    articles: Article[];
    breakdown: Record<string, { count: number; error?: string }>;
  }> {
    // Fetch API keys from settings
    const scopusKey = this.db.getSetting('scopus_api_key') || '';
    const wosKey = this.db.getSetting('wos_api_key') || '';

    const activeIntegrators: { name: string; promise: Promise<NormalizedArticle[]> }[] = [];

    // Select integrators based on the queryMap provided by the frontend.
    // If a database is missing in the map, it means the user deactivated it.
    // limit is applied per-database (each base fetches up to 'limit' articles)
    if (queryMap.openalex)
      activeIntegrators.push({ name: 'openalex', promise: this.api.searchOpenAlex(queryMap.openalex, sortBy, limit) });
    if (queryMap.crossref)
      activeIntegrators.push({ name: 'crossref', promise: this.api.searchCrossref(queryMap.crossref, sortBy, limit) });
    if (queryMap.scopus)
      activeIntegrators.push({
        name: 'scopus',
        promise: this.api.searchScopus(queryMap.scopus, scopusKey, sortBy, limit),
      });
    if (queryMap.wos)
      activeIntegrators.push({ name: 'wos', promise: this.api.searchWoS(queryMap.wos, wosKey, sortBy, limit) });

    const breakdown: Record<string, { count: number; error?: string }> = {};
    const resultsArray = await Promise.all(
      activeIntegrators.map((ai) =>
        ai.promise
          .then((res) => {
            breakdown[ai.name] = { count: res.length };
            return res;
          })
          .catch((err) => {
            breakdown[ai.name] = { count: 0, error: err.message || 'Erro desconhecido' };
            return [];
          }),
      ),
    );

    const combinedResults = resultsArray.flat();

    const deduplicated = this.deduplicate(combinedResults);

    // Save to history first to get searchId
    const searchId = this.db.saveSearchHistory(
      projectId,
      unifiedQuery,
      queryMap,
      deduplicated.length,
      breakdown,
      sortBy,
      limit,
    );

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
        csl_json: JSON.stringify(article.csl_json),
        search_id: searchId,
        is_oa: article.is_oa,
        publisher: article.publisher,
      });
      savedCount++;
    }

    const projectArticles = this.db.getArticlesByProject(projectId);
    return { savedCount, articles: projectArticles, breakdown };
  }

  normalizeTitle(title: string): string {
    if (!title) return '';
    return title
      .replace(/<[^>]*>/g, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private findExistingIndex(
    item: NormalizedArticle,
    seenDoi: Map<string, number>,
    seenTitle: Map<string, number>,
  ): number | undefined {
    const doi = item.doi;
    const title = this.normalizeTitle(item.title || '');
    if (doi && seenDoi.has(doi)) {
      return seenDoi.get(doi);
    }
    if (title && seenTitle.has(title)) {
      return seenTitle.get(title);
    }
    return undefined;
  }

  private mergeOrAdd(
    item: NormalizedArticle,
    deduplicated: NormalizedArticle[],
    seenDoi: Map<string, number>,
    seenTitle: Map<string, number>,
  ): void {
    const idx = this.findExistingIndex(item, seenDoi, seenTitle);
    if (idx !== undefined) {
      const existing = deduplicated[idx];
      const newSource = item.source_databases[0];
      if (!existing.source_databases.includes(newSource)) {
        existing.source_databases.push(newSource);
      }
      return;
    }
    const newIdx = deduplicated.length;
    deduplicated.push(item);
    if (item.doi) seenDoi.set(item.doi, newIdx);
    const title = this.normalizeTitle(item.title || '');
    if (title) seenTitle.set(title, newIdx);
  }

  private deduplicate(results: NormalizedArticle[]): NormalizedArticle[] {
    const seenDoi = new Map<string, number>();
    const seenTitle = new Map<string, number>();
    const deduplicated: NormalizedArticle[] = [];

    for (const item of results) {
      this.mergeOrAdd(item, deduplicated, seenDoi, seenTitle);
    }

    return deduplicated;
  }
}

import { DatabaseAdapter } from '../database/DatabaseAdapter';
import { QueryTranslator } from './QueryTranslator';
import { ApiIntegrator } from './ApiIntegrator';
import { NormalizedArticle } from './types';
import type { PagedResult } from './searchApis/paginate';
import { PendingSearchStore } from './PendingSearchStore';
import { doiKey } from '../utils/doi';
import type {
  QuerySort,
  SavedSearchSummary,
  SearchBreakdown,
  SearchPreview,
  SearchPreviewDetails,
} from '../../src/types';

// NormalizedArticle (API shape) → article columns; shared by the review dialog and the save.
function previewDetails(article: NormalizedArticle): SearchPreviewDetails {
  return {
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
    publisher: article.publisher,
    is_oa: article.is_oa,
    issn: article.issn,
    citation_count: article.citationCount,
  };
}

/** A search that ran but is not saved: everything needed to persist it later, exactly as found. */
interface PendingSearch {
  projectId: number;
  queryMap: Record<string, string>;
  limit: number;
  sortBy: QuerySort;
  unifiedQuery: string;
  // JSON of the query builder state, saved so the search can be reopened in the builder.
  queryState?: string;
  breakdown: SearchBreakdown;
  articles: NormalizedArticle[];
}

export class SearchOrchestrator {
  constructor(
    private db: DatabaseAdapter,
    private translator: QueryTranslator,
    private api: ApiIntegrator,
    private pending: PendingSearchStore<PendingSearch> = new PendingSearchStore(),
  ) {}

  /**
   * Runs the search on every database in `queryMap` and keeps the deduplicated results in memory,
   * so the user can review them before anything is written to the project.
   *
   * @example const { previewId, results } = await orchestrator.preview(1, { openalex: 'title.search:x' }, 50, 'relevance', 'x');
   */
  public async preview(
    projectId: number,
    queryMap: Record<string, string>,
    limit: number,
    sortBy: QuerySort,
    unifiedQuery: string,
    queryState?: string,
  ): Promise<SearchPreview> {
    const { articles, breakdown } = await this.fetchDeduplicated(queryMap, limit, sortBy);
    const previewId = this.pending.put({
      projectId,
      queryMap,
      limit,
      sortBy,
      unifiedQuery,
      queryState,
      breakdown,
      articles,
    });
    const results = articles.map((a) => ({
      title: a.title,
      authors: a.authors,
      year: a.year,
      doi: a.doi,
      sourceDatabases: a.source_databases,
      alreadyInProject: !!this.db.findDuplicateArticle(projectId, a.doi, a.title),
      details: previewDetails(a),
    }));
    return { previewId, breakdown, results };
  }

  /**
   * Saves a previewed search: one history entry plus its articles (duplicates merge into existing ones).
   * savedCount is how many articles were new to the project.
   *
   * @example await orchestrator.savePreview(previewId); // { savedCount: 12, breakdown }
   */
  public savePreview(previewId: string): SavedSearchSummary {
    const search = this.pending.get(previewId);
    if (!search) {
      throw new Error(
        `Busca não encontrada para salvar. Offending value: previewId=${previewId}. Expected shape: ID de uma busca feita nesta sessão e ainda não salva nem descartada.`,
      );
    }
    // Removed only after it is written, so a failed save can be retried from the same results.
    const savedCount = this.persist(search);
    this.pending.discard(previewId);
    return { savedCount, breakdown: search.breakdown };
  }

  /** Drops a previewed search without touching the project. */
  public discardPreview(previewId: string): void {
    this.pending.discard(previewId);
  }

  private async fetchDeduplicated(queryMap: Record<string, string>, limit: number, sortBy: QuerySort) {
    const breakdown: SearchBreakdown = {};
    const perDatabase = await Promise.all(
      this.activeIntegrators(queryMap, limit, sortBy).map(({ name, promise }) =>
        promise
          .then(({ articles, warning }) => {
            // A base stopped mid-search keeps what arrived; the warning tells the user why it is short.
            breakdown[name] = warning ? { count: articles.length, warning } : { count: articles.length };
            return articles;
          })
          .catch((err) => {
            breakdown[name] = { count: 0, error: err.message || 'Erro desconhecido' };
            return [] as NormalizedArticle[];
          }),
      ),
    );
    return { articles: this.deduplicate(perDatabase.flat()), breakdown };
  }

  // A database missing from queryMap was deactivated by the user; limit applies per database.
  private activeIntegrators(queryMap: Record<string, string>, limit: number, sortBy: QuerySort) {
    const scopusKey = this.db.getSetting('scopus_api_key') || '';
    const wosKey = this.db.getSetting('wos_api_key') || '';
    const integrators: { name: string; promise: Promise<PagedResult> }[] = [];
    if (queryMap.openalex)
      integrators.push({ name: 'openalex', promise: this.api.searchOpenAlex(queryMap.openalex, sortBy, limit) });
    if (queryMap.crossref)
      integrators.push({ name: 'crossref', promise: this.api.searchCrossref(queryMap.crossref, sortBy, limit) });
    if (queryMap.scopus)
      integrators.push({ name: 'scopus', promise: this.api.searchScopus(queryMap.scopus, scopusKey, sortBy, limit) });
    if (queryMap.wos)
      integrators.push({ name: 'wos', promise: this.api.searchWoS(queryMap.wos, wosKey, sortBy, limit) });
    return integrators;
  }

  /** Writes the history entry and the articles; returns how many were new to the project. */
  private persist(search: PendingSearch): number {
    const { projectId, queryMap, unifiedQuery, breakdown, sortBy, limit, articles, queryState } = search;
    // Results already in the project only get their source list merged, so they do not count as
    // saved by this search (and "Desfazer Busca" does not remove them).
    const addedCount = articles.filter((a) => !this.db.findDuplicateArticle(projectId, a.doi, a.title)).length;
    const searchId = this.db.saveSearchHistory(
      projectId,
      unifiedQuery,
      queryMap,
      addedCount,
      breakdown,
      sortBy,
      limit,
      queryState,
    );
    for (const article of articles) {
      this.db.saveArticle(projectId, {
        doi: article.doi,
        title: article.title,
        authors: article.authors,
        year: article.year,
        ...previewDetails(article),
        source_query: JSON.stringify(queryMap),
        source_databases: JSON.stringify(article.source_databases),
        csl_json: JSON.stringify(article.csl_json),
        search_id: searchId,
      });
    }
    return addedCount;
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
    const doi = doiKey(item.doi);
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
      // A match by title may bring a DOI (or a differently written title) that later results use.
      this.rememberKeys(item, idx, seenDoi, seenTitle);
      return;
    }
    deduplicated.push(item);
    this.rememberKeys(item, deduplicated.length - 1, seenDoi, seenTitle);
  }

  private rememberKeys(
    item: NormalizedArticle,
    idx: number,
    seenDoi: Map<string, number>,
    seenTitle: Map<string, number>,
  ): void {
    const doi = doiKey(item.doi);
    if (doi && !seenDoi.has(doi)) seenDoi.set(doi, idx);
    const title = this.normalizeTitle(item.title || '');
    if (title && !seenTitle.has(title)) seenTitle.set(title, idx);
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

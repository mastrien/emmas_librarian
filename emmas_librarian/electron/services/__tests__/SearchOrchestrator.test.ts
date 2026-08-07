import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchOrchestrator } from '../SearchOrchestrator';
import { QueryTranslator } from '../QueryTranslator';
import { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { OpenAlexArticle } from '../services/openalex/types';

let mockLoadablePath: string | null = null;
vi.mock('sqlite-vec', async (importOriginal) => {
  const original = await importOriginal<typeof import('sqlite-vec')>();
  return {
    ...original,
    getLoadablePath: () => mockLoadablePath || original.getLoadablePath(),
  };
});
import { ApiIntegrator } from '../ApiIntegrator';
import { NormalizedArticle } from '../types';
import { Article } from '../../../src/types';
import { ArticleInput } from '../../database/DatabaseAdapter';

// ---------------------------------------------------------------------------
// In-memory mock for DatabaseAdapter — avoids the native better-sqlite3 dep.
// Tracks articles, settings, and search history so deduplication and
// API-key tests work without a real database.
// ---------------------------------------------------------------------------

interface StoredSearchHistory {
  sort_by: string | null;
  limit_val: number | null;
  project_id: number;
}

/** Minimal mock that satisfies SearchOrchestrator + test assertions. */
class MockDatabaseAdapter {
  private articles: Article[] = [];
  private settings = new Map<string, string>();
  private searchHistory: StoredSearchHistory[] = [];
  private nextArticleId = 1;
  private nextProjectId = 1;
  private nextSearchId = 1;

  createProject(name: string): { id: number; name: string } {
    const id = this.nextProjectId++;
    return { id, name };
  }

  getSetting(key: string): string | null {
    return this.settings.get(key) ?? null;
  }

  setSetting(key: string, value: string): void {
    this.settings.set(key, value);
  }

  /**
   * Mimics the real upsert: if an article with the same DOI already exists
   * for the project, merge source_databases instead of inserting a duplicate.
   */
  saveArticle(projectId: number, data: ArticleInput): number {
    const existing = this.articles.find(
      (a) => a.project_id === projectId && a.doi && data.doi && a.doi === data.doi,
    );

    if (existing) {
      // Merge source_databases arrays (stored as JSON strings)
      const existingSources: string[] = JSON.parse(existing.source_databases);
      const incomingSources: string[] = JSON.parse(data.source_databases);
      for (const src of incomingSources) {
        if (!existingSources.includes(src)) existingSources.push(src);
      }
      existing.source_databases = JSON.stringify(existingSources);
      return existing.id;
    }

    const id = this.nextArticleId++;
    this.articles.push({
      id,
      project_id: projectId,
      doi: data.doi,
      title: data.title,
      source_databases: data.source_databases,
      source_query: data.source_query,
      csl_json: data.csl_json,
      status: 'new',
    });
    return id;
  }

  getArticlesByProject(projectId: number): Article[] {
    return this.articles.filter((a) => a.project_id === projectId);
  }

  saveSearchHistory(
    projectId: number,
    _unifiedQuery: string,
    _queryMap: Record<string, string>,
    _totalResults: number,
    _breakdown: Record<string, unknown>,
    sortBy?: string,
    limitVal?: number,
  ): number {
    const id = this.nextSearchId++;
    this.searchHistory.push({
      project_id: projectId,
      sort_by: sortBy ?? null,
      limit_val: limitVal ?? null,
    });
    return id;
  }

  getSearchHistory(projectId: number): StoredSearchHistory[] {
    return this.searchHistory.filter((h) => h.project_id === projectId);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SearchOrchestrator', () => {
  let db: MockDatabaseAdapter;
  let orchestrator: SearchOrchestrator;
  let api: ApiIntegrator;

  beforeEach(() => {
    db = new MockDatabaseAdapter();
    const translator = new QueryTranslator();
    api = new ApiIntegrator();
    // The orchestrator accepts DatabaseAdapter, but our mock satisfies every
    // method it actually calls — cast through unknown to keep strict typing.
    orchestrator = new SearchOrchestrator(
      db as unknown as import('../../database/DatabaseAdapter').DatabaseAdapter,
      translator,
      api,
    );
  });

  it('deduplicates articles and merges sources', async () => {
    const proj = db.createProject('Test');

    const item1: NormalizedArticle = {
      doi: '10.123/abc',
      title: 'Test Article',
      source_databases: ['OpenAlex'],
      csl_json: {},
    };
    const item2: NormalizedArticle = {
      doi: '10.123/abc',
      title: 'Test Article',
      source_databases: ['Crossref'],
      csl_json: {},
    };

    vi.spyOn(api, 'searchOpenAlex').mockResolvedValue([item1]);
    vi.spyOn(api, 'searchCrossref').mockResolvedValue([item2]);

    const res = await orchestrator.searchAndPersist(
      proj.id,
      { openalex: 'filter=title.search:test', crossref: 'query=test' },
      100,
      'relevance',
      'title contains "test"',
    );

    expect(res.savedCount).toBe(1);
    const articles = db.getArticlesByProject(proj.id);
    expect(articles).toHaveLength(1);
    expect(articles[0].source_databases).toBe('["OpenAlex","Crossref"]');

    const history = db.getSearchHistory(proj.id);
    expect(history).toHaveLength(1);
    expect(history[0].sort_by).toBe('relevance');
    expect(history[0].limit_val).toBe(100);
  });

  it('does not duplicate articles when running the exact same search twice', async () => {
    const proj = db.createProject('Duplicate Search Project');

    const item: NormalizedArticle = {
      doi: '10.5555/dup-search',
      title: 'Same Search Article',
      source_databases: ['OpenAlex'],
      csl_json: {},
    };

    vi.spyOn(api, 'searchOpenAlex').mockResolvedValue([item]);

    // Run first search
    const res1 = await orchestrator.searchAndPersist(
      proj.id,
      { openalex: 'filter=title.search:dup' },
      100,
      'relevance',
      'title contains "dup"',
    );
    expect(res1.savedCount).toBe(1);

    // Run second search (same query and result)
    const res2 = await orchestrator.searchAndPersist(
      proj.id,
      { openalex: 'filter=title.search:dup' },
      100,
      'relevance',
      'title contains "dup"',
    );
    expect(res2.savedCount).toBe(1);

    // Assert that the database contains only one article for this project
    const articles = db.getArticlesByProject(proj.id);
    expect(articles).toHaveLength(1);
  });

  it('decrypts and passes Scopus and WoS API keys correctly, supporting legacy naming fallback', async () => {
    const proj = db.createProject('Key Test');

    // The orchestrator reads 'scopus_api_key' and 'wos_api_key', so set
    // those keys directly on the mock settings store.
    db.setSetting('scopus_api_key', 'scopus-secret-key');
    db.setSetting('wos_api_key', 'wos-secret-key');

    // Spies to verify values passed
    const scopusSpy = vi.spyOn(api, 'searchScopus').mockResolvedValue([]);
    const wosSpy = vi.spyOn(api, 'searchWoS').mockResolvedValue([]);

    await orchestrator.searchAndPersist(
      proj.id,
      { scopus: 'title("test")', wos: 'TS=test' },
      50,
      'relevance',
      'title contains "test"',
    );

    // Verify both keys were decrypted and passed properly
    expect(scopusSpy).toHaveBeenCalledWith('title("test")', 'scopus-secret-key', 'relevance', 50);
    expect(wosSpy).toHaveBeenCalledWith('TS=test', 'wos-secret-key', 'relevance', 50);
  });

  it('covers complex title normalization (extra spaces, accents/diacritics, HTML tags, SQL special characters)', () => {
    const title1 = '  Hello <i>World</i>!  ';
    const title2 = 'hello world!';
    expect(orchestrator.normalizeTitle(title1)).toBe(orchestrator.normalizeTitle(title2));

    const titleAccents = 'Café e Ação';
    const titleNoAccents = 'cafe e acao';
    expect(orchestrator.normalizeTitle(titleAccents)).toBe(orchestrator.normalizeTitle(titleNoAccents));

    const titleSql = "SELECT * FROM 'articles'; --";
    // SQL special characters like ';-* are removed, lowercased, and trimmed
    expect(orchestrator.normalizeTitle(titleSql)).toBe('select from articles');
  });
});

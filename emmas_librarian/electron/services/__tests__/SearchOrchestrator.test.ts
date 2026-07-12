import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchOrchestrator } from '../SearchOrchestrator';
import { QueryTranslator } from '../QueryTranslator';
import { ApiIntegrator } from '../ApiIntegrator';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { NormalizedArticle } from '../types';

// Mock electron's safeStorage before importing anything that might use it
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((str) => Buffer.from(`encrypted_${str}`)),
    decryptString: vi.fn((buf) => buf.toString().replace('encrypted_', '')),
  },
}));

describe('SearchOrchestrator', () => {
  let db: DatabaseAdapter;
  let orchestrator: SearchOrchestrator;
  let api: ApiIntegrator;

  beforeEach(() => {
    db = new DatabaseAdapter(':memory:');
    const translator = new QueryTranslator();
    api = new ApiIntegrator();
    orchestrator = new SearchOrchestrator(db, translator, api);
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

    const history = db.getSearchHistory(proj.id) as { sort_by: string | null; limit_val: number | null }[];
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

    // 1. Save Scopus key with legacy name, WoS key with current name
    db.setSetting('api_key_scopus', 'scopus-secret-key');
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

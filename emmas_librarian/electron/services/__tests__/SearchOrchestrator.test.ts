import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchOrchestrator } from '../SearchOrchestrator';
import { QueryTranslator } from '../QueryTranslator';
import { ApiIntegrator } from '../ApiIntegrator';
import { DatabaseManager } from '../../database/DatabaseManager';
import { NormalizedArticle } from '../types';

// Mock electron's safeStorage before importing anything that might use it
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((str) => Buffer.from(`encrypted_${str}`)),
    decryptString: vi.fn((buf) => buf.toString().replace('encrypted_', ''))
  }
}));

describe('SearchOrchestrator', () => {
  let db: DatabaseManager;
  let orchestrator: SearchOrchestrator;
  let api: ApiIntegrator;

  beforeEach(() => {
    db = new DatabaseManager(':memory:');
    const translator = new QueryTranslator();
    api = new ApiIntegrator();
    orchestrator = new SearchOrchestrator(db, translator, api);
  });

  it('deduplicates articles and merges sources', async () => {
    const proj = db.createProject('Test');
    
    const item1: NormalizedArticle = {
      doi: '10.123/abc', title: 'Test Article', source_databases: ['OpenAlex'], csl_json: {}
    };
    const item2: NormalizedArticle = {
      doi: '10.123/abc', title: 'Test Article', source_databases: ['Crossref'], csl_json: {}
    };

    vi.spyOn(api, 'searchOpenAlex').mockResolvedValue([item1]);
    vi.spyOn(api, 'searchCrossref').mockResolvedValue([item2]);

    const res = await orchestrator.searchAndPersist(proj.id, { openalex: 'filter=title.search:test', crossref: 'query=test' }, 100, 'relevance', 'title contains "test"');
    
    expect(res.savedCount).toBe(1);
    const articles = db.getArticlesByProject(proj.id);
    expect(articles).toHaveLength(1);
    expect(articles[0].source_databases).toBe('["OpenAlex","Crossref"]');
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
      'title contains "test"'
    );

    // Verify both keys were decrypted and passed properly
    expect(scopusSpy).toHaveBeenCalledWith('title("test")', 'scopus-secret-key', 'relevance', 50);
    expect(wosSpy).toHaveBeenCalledWith('TS=test', 'wos-secret-key', 'relevance', 50);
  });
});

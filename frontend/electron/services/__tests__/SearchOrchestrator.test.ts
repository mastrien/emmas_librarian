import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchOrchestrator } from '../SearchOrchestrator';
import { QueryTranslator } from '../QueryTranslator';
import { ApiIntegrator } from '../ApiIntegrator';
import { DatabaseManager } from '../../database/DatabaseManager';
import { NormalizedArticle } from '../types';

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

    const res = await orchestrator.executeSearch(proj.id, [{id:'1', field:'title', type:'contains', value:'test'}]);
    
    expect(res.savedCount).toBe(1);
    const articles = db.getArticlesByProject(proj.id);
    expect(articles).toHaveLength(1);
    expect(articles[0].source_databases).toBe('["OpenAlex","Crossref"]');
  });
});

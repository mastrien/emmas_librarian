import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiIntegrator } from '../ApiIntegrator';
import {
  countCitations,
  runSnowball,
  snowballQuery,
  snowballSourceName,
  validateCitationRequest,
} from '../citationSnowball';
import { QueryTranslator } from '../QueryTranslator';
import { SearchOrchestrator } from '../SearchOrchestrator';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import type { PagedResult } from '../searchApis/paginate';
import type { CitationSeedInfo } from '../searchApis/openAlexCitations';
import type { NormalizedArticle } from '../types';
import type { CitationSeed, SearchHistoryItem } from '../../../src/types';
import { isOutsideSearchEntry } from '../../../src/utils/outsideSearchEntries';
import { FakeSecretStore } from '../../ports/__tests__/fakes/FakeSecretStore';

const work = (id: string): NormalizedArticle => ({
  doi: `10.1/${id}`,
  title: `Estudo ${id}`,
  authors: 'Silva',
  year: 2020,
  source_databases: ['OpenAlex'],
  csl_json: { id },
});

/** Stands in for OpenAlex: each seed by its DOI, and every call recorded. */
class FakeCitationApi extends ApiIntegrator {
  seeds: Record<string, CitationSeedInfo | null> = {};
  referenced: (ids: string[], limit: number) => PagedResult | Promise<PagedResult> = (ids, limit) => ({
    articles: ids.slice(0, limit).map(work),
    requests: 1,
    available: ids.length,
  });
  citing: (id: string, limit: number) => PagedResult | Promise<PagedResult> = () => ({
    articles: [],
    requests: 1,
    available: 0,
  });
  budgets: number[] = [];

  override async fetchCitationSeed({ doi }: { doi?: string }) {
    return this.seeds[doi ?? ''] ?? null;
  }

  override async searchReferencedWorks(ids: string[], limit: number) {
    this.budgets.push(limit);
    return this.referenced(ids, limit);
  }

  override async searchCitingWorks(id: string, limit: number) {
    this.budgets.push(limit);
    return this.citing(id, limit);
  }
}

const seed = (n: number): CitationSeed => ({ articleId: n, title: `Artigo ${n}`, doi: `10.9/${n}` });
const info = (references: string[], citedByCount = 0, openAlexId = 'W0'): CitationSeedInfo => ({
  openAlexId,
  referencedIds: references,
  citedByCount,
});

let api: FakeCitationApi;

beforeEach(() => {
  api = new FakeCitationApi();
});

describe('validateCitationRequest', () => {
  const valid = { seeds: [seed(1)], directions: ['references' as const], limit: 10 };

  it('accepts a request the modal can send', () => {
    expect(() => validateCitationRequest(valid)).not.toThrow();
  });

  it.each([
    [{ ...valid, seeds: [] }, 'seeds=[]'],
    [{ ...valid, directions: [] }, 'directions=[]'],
    [{ ...valid, limit: 0 }, 'limit=0'],
    [{ ...valid, limit: 1001 }, 'limit=1001'],
    [{ ...valid, limit: 1.5 }, 'limit=1.5'],
  ])('names what is wrong', (request, offending) => {
    expect(() => validateCitationRequest(request)).toThrow(offending);
  });
});

describe('countCitations', () => {
  it('says how much each article has, and which one OpenAlex does not know', async () => {
    api.seeds = { '10.9/1': info(['W1', 'W2'], 8) };

    expect(await countCitations(api, [seed(1), seed(2)], '')).toEqual([
      { articleId: 1, title: 'Artigo 1', found: true, references: 2, citedBy: 8 },
      { articleId: 2, title: 'Artigo 2', found: false, references: 0, citedBy: 0 },
    ]);
  });
});

describe('runSnowball', () => {
  it('splits the limit evenly, so the first article cannot use it all', async () => {
    api.seeds = { '10.9/1': info(['W1']), '10.9/2': info(['W2']) };

    await runSnowball(api, { seeds: [seed(1), seed(2)], directions: ['references', 'citedBy'], limit: 100 }, '');

    expect(api.budgets).toEqual([25, 25, 25, 25]);
  });

  it('warns when there was more than the limit', async () => {
    api.seeds = { '10.9/1': info(['W1', 'W2', 'W3']) };

    const { articles, outcome } = await runSnowball(
      api,
      { seeds: [seed(1)], directions: ['references'], limit: 2 },
      '',
    );

    expect(articles).toHaveLength(2);
    expect(outcome).toMatchObject({ count: 2, requested: 2, available: 3 });
    expect(outcome.warning).toBe('Limite de 2 atingido: havia 3 trabalhos nestas citações.');
  });

  it('skips an article OpenAlex does not know', async () => {
    api.seeds = { '10.9/2': info(['W2']) };

    const { articles } = await runSnowball(
      api,
      { seeds: [seed(1), seed(2)], directions: ['references'], limit: 10 },
      '',
    );

    expect(articles.map((a) => a.title)).toEqual(['Estudo W2']);
  });

  it('fails when nothing arrived, and keeps what did when a later request fails', async () => {
    const request = { seeds: [seed(1)], directions: ['references', 'citedBy'] as const, limit: 10 };
    api.seeds = { '10.9/1': info(['W1']) };
    api.citing = () => Promise.reject(new Error('429 do OpenAlex'));

    const { articles, outcome } = await runSnowball(api, { ...request, directions: [...request.directions] }, '');
    expect(articles).toHaveLength(1);
    expect(outcome.warning).toBe('Parou antes do fim: 429 do OpenAlex');

    api.referenced = () => Promise.reject(new Error('429 do OpenAlex'));
    await expect(runSnowball(api, { ...request, directions: [...request.directions] }, '')).rejects.toThrow('429');
  });
});

describe('how a run is named', () => {
  it('names one article, or counts several', () => {
    expect(snowballQuery([{ title: 'A' }])).toBe('Snowballing: A');
    expect(snowballQuery([{ title: 'A' }, { title: 'B' }])).toBe('Snowballing: 2 artigos (A; …)');
    expect(snowballSourceName([{ title: 'A' }])).toBe('Citações de "A"');
    expect(snowballSourceName([{ title: 'A' }, { title: 'B' }])).toBe('Citações de 2 artigos');
  });
});

// Against real SQLite: what a saved snowballing leaves in the project (#51).
describe('SearchOrchestrator snowballing', () => {
  let db: DatabaseAdapter;
  let orchestrator: SearchOrchestrator;
  let projectId: number;
  const request = { seeds: [seed(1)], directions: ['references' as const], limit: 10 };

  beforeEach(() => {
    db = new DatabaseAdapter(':memory:', new FakeSecretStore());
    orchestrator = new SearchOrchestrator(db, new QueryTranslator(), api);
    projectId = db.createProject('Revisão').id;
    api.seeds = { '10.9/1': info(['W1', 'W2']) };
  });

  const history = () => db.getSearchHistory(projectId) as SearchHistoryItem[];

  it('opens a preview that marks what the project already has, and saves nothing yet', async () => {
    db.saveArticle(projectId, { doi: '10.1/W1', title: 'Estudo W1', authors: 'Silva' } as never);

    const preview = await orchestrator.previewCitations(projectId, request);

    expect(preview.results.map((r) => r.alreadyInProject)).toEqual([true, false]);
    expect(history()).toEqual([]);
  });

  it('saves to the history as snowballing, with the article it started from, among the other methods', async () => {
    const { previewId } = await orchestrator.previewCitations(projectId, request);

    const { savedCount } = orchestrator.savePreview(previewId);

    expect(savedCount).toBe(2);
    const [entry] = history();
    expect(entry.unified_query).toBe('Snowballing: Artigo 1');
    expect(JSON.parse(entry.results_breakdown)).toHaveProperty('Snowballing');
    expect(isOutsideSearchEntry(entry)).toBe(true);
  });

  it('tags the new articles as citation searching on the PRISMA diagram', async () => {
    const { previewId } = await orchestrator.previewCitations(projectId, request);

    orchestrator.savePreview(previewId);

    const [source] = db.prismaOriginRepo.listSources(projectId);
    expect(source).toMatchObject({ name: 'Citações de "Artigo 1"', method: 'citations' });
    expect(db.prismaOriginRepo.listOrigins(projectId)).toHaveLength(2);
  });

  it('creates no source when nothing was new', async () => {
    db.saveArticle(projectId, { doi: '10.1/W1', title: 'Estudo W1', authors: 'S' } as never);
    db.saveArticle(projectId, { doi: '10.1/W2', title: 'Estudo W2', authors: 'S' } as never);
    const { previewId } = await orchestrator.previewCitations(projectId, request);

    expect(orchestrator.savePreview(previewId).savedCount).toBe(0);

    expect(db.prismaOriginRepo.listSources(projectId)).toEqual([]);
  });

  it('merges what two articles cite in common', async () => {
    api.seeds = { '10.9/1': info(['W1']), '10.9/2': info(['W1']) };

    const preview = await orchestrator.previewCitations(projectId, { ...request, seeds: [seed(1), seed(2)] });

    expect(preview.results).toHaveLength(1);
  });

  it('shows a failure in the preview, as a base that failed', async () => {
    api.referenced = () => Promise.reject(new Error('429 do OpenAlex'));

    const preview = await orchestrator.previewCitations(projectId, request);

    expect(preview.breakdown.Snowballing.error).toBe('429 do OpenAlex');
    expect(preview.results).toEqual([]);
  });

  it('rejects an invalid request before calling OpenAlex', async () => {
    await expect(orchestrator.previewCitations(projectId, { ...request, limit: 0 })).rejects.toThrow('limit=0');
    expect(api.budgets).toEqual([]);
  });

  it('peeks with the key the settings hold', async () => {
    const spy = vi.spyOn(api, 'fetchCitationSeed');
    db.setSetting('openalex_api_key', 'segredo');

    await orchestrator.peekCitations([seed(1)]);

    expect(spy).toHaveBeenCalledWith({ openAlexId: undefined, doi: '10.9/1' }, 'segredo');
  });
});

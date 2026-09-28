import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchOrchestrator } from '../SearchOrchestrator';
import { QueryTranslator } from '../QueryTranslator';
import { ApiIntegrator } from '../ApiIntegrator';
import { NormalizedArticle } from '../types';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import type { PagedResult } from '../searchApis/paginate';

// Settings are encrypted with safeStorage; a reversible fake keeps the real SettingsRepository path.
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((str: string) => Buffer.from(`encrypted_${str}`)),
    decryptString: vi.fn((buf: Buffer) => buf.toString().replace('encrypted_', '')),
  },
}));

type DatabaseName = 'openalex' | 'crossref' | 'scopus' | 'wos';

/** Stands in for the network: each database returns canned articles and records what it was asked. */
class FakeApiIntegrator extends ApiIntegrator {
  readonly results: Partial<Record<DatabaseName, NormalizedArticle[] | Error>> = {};
  /** A base that stopped mid-search: its articles are kept and this explains why there are fewer. */
  readonly warnings: Partial<Record<DatabaseName, string>> = {};
  readonly calls: { database: DatabaseName; args: unknown[] }[] = [];

  override async searchOpenAlex(...args: unknown[]): Promise<PagedResult> {
    return this.answer('openalex', args);
  }

  override async searchCrossref(...args: unknown[]): Promise<PagedResult> {
    return this.answer('crossref', args);
  }

  override async searchScopus(...args: unknown[]): Promise<PagedResult> {
    return this.answer('scopus', args);
  }

  override async searchWoS(...args: unknown[]): Promise<PagedResult> {
    return this.answer('wos', args);
  }

  private answer(database: DatabaseName, args: unknown[]): PagedResult {
    this.calls.push({ database, args });
    const result = this.results[database] ?? [];
    if (result instanceof Error) throw result;
    // Fresh copies: the orchestrator merges source lists in place while deduplicating.
    const articles = result.map((a) => ({ ...a, source_databases: [...a.source_databases] }));
    const warning = this.warnings[database];
    return warning ? { articles, warning } : { articles };
  }
}

const found = (doi: string, title: string, source: string): NormalizedArticle => ({
  doi,
  title,
  authors: 'Ana Lima',
  year: 2024,
  source_databases: [source],
  csl_json: {},
});

describe('SearchOrchestrator', () => {
  let db: DatabaseAdapter;
  let api: FakeApiIntegrator;
  let orchestrator: SearchOrchestrator;
  let projectId: number;

  beforeEach(() => {
    db = new DatabaseAdapter(':memory:');
    api = new FakeApiIntegrator();
    orchestrator = new SearchOrchestrator(db, new QueryTranslator(), api);
    projectId = db.createProject('Revisão').id;
  });

  afterEach(() => {
    db.close();
  });

  describe('preview', () => {
    it('returns deduplicated results with merged sources and writes nothing to the project', async () => {
      api.results.openalex = [found('10.123/abc', 'Test Article', 'OpenAlex')];
      api.results.crossref = [found('10.123/abc', 'Test Article', 'Crossref')];

      const preview = await orchestrator.preview(
        projectId,
        { openalex: 'filter=title.search:test', crossref: 'query=test' },
        100,
        'relevance',
        'title contains "test"',
      );

      expect(preview.results).toEqual([
        {
          title: 'Test Article',
          authors: 'Ana Lima',
          year: 2024,
          doi: '10.123/abc',
          sourceDatabases: ['OpenAlex', 'Crossref'],
          alreadyInProject: false,
          details: {},
        },
      ]);
      expect(preview.breakdown).toEqual({ openalex: { count: 1 }, crossref: { count: 1 } });
      expect(db.getArticlesByProject(projectId)).toHaveLength(0);
      expect(db.getSearchHistory(projectId)).toHaveLength(0);
    });

    it('carries the full metadata of each result for the details dialog, and saves the same values', async () => {
      api.results.openalex = [
        {
          ...found('10.1/rich', 'Rico em metadados', 'OpenAlex'),
          abstract: 'Resumo do artigo.',
          journal: 'Revista X',
          authorKeywords: 'ontologia; clima',
          citationCount: 42,
          is_oa: 1,
        },
      ];

      const preview = await orchestrator.preview(projectId, { openalex: 'q' }, 50, 'relevance', 'q');
      orchestrator.savePreview(preview.previewId);

      expect(preview.results[0].details).toMatchObject({
        abstract: 'Resumo do artigo.',
        journal: 'Revista X',
        author_keywords: 'ontologia; clima',
        citation_count: 42,
        is_oa: 1,
      });
      // SQLite returns null for the fields the API left empty, so compare the ones it filled.
      expect(db.getArticlesByProject(projectId)[0]).toMatchObject({
        abstract: 'Resumo do artigo.',
        journal: 'Revista X',
        author_keywords: 'ontologia; clima',
        citation_count: 42,
        is_oa: 1,
      });
    });

    // DOIs are case-insensitive; bases do not agree on case (e.g. 10.1016/J.X vs 10.1016/j.x).
    it('treats DOIs that differ only in case as the same article', async () => {
      db.saveArticle(projectId, {
        doi: '10.1016/j.old',
        title: 'Old',
        source_query: 'q',
        source_databases: '[]',
        csl_json: '{}',
      });
      api.results.openalex = [
        found('10.1016/j.env.2024', 'Soil moisture', 'OpenAlex'),
        found('10.1016/J.OLD', 'Old (v2)', 'OpenAlex'),
      ];
      api.results.scopus = [found('10.1016/J.ENV.2024', 'Soil Moisture: a review', 'Scopus')];

      const preview = await orchestrator.preview(projectId, { openalex: 'q', scopus: 'q' }, 50, 'relevance', 'q');

      expect(preview.results.map((r) => [r.doi, r.sourceDatabases, r.alreadyInProject])).toEqual([
        ['10.1016/j.env.2024', ['OpenAlex', 'Scopus'], false],
        ['10.1016/J.OLD', ['OpenAlex'], true],
      ]);
    });

    it('links a third result by the DOI of one that was merged by title', async () => {
      api.results.openalex = [found('', 'Soil moisture review', 'OpenAlex')];
      api.results.crossref = [found('10.1/soil', 'Soil Moisture Review', 'Crossref')];
      api.results.scopus = [found('10.1/SOIL', 'Soil moisture: a review', 'Scopus')];

      const preview = await orchestrator.preview(
        projectId,
        { openalex: 'q', crossref: 'q', scopus: 'q' },
        50,
        'relevance',
        'q',
      );

      expect(preview.results.map((r) => r.sourceDatabases)).toEqual([['OpenAlex', 'Crossref', 'Scopus']]);
    });

    it('flags results that are already in the project', async () => {
      db.saveArticle(projectId, {
        doi: '10.1/old',
        title: 'Old',
        source_query: 'q',
        source_databases: '[]',
        csl_json: '{}',
      });
      api.results.openalex = [found('10.1/old', 'Old', 'OpenAlex'), found('10.1/new', 'New', 'OpenAlex')];

      const preview = await orchestrator.preview(projectId, { openalex: 'q' }, 50, 'relevance', 'q');

      expect(preview.results.map((r) => [r.doi, r.alreadyInProject])).toEqual([
        ['10.1/old', true],
        ['10.1/new', false],
      ]);
    });

    it('reports a failing database in the breakdown and keeps the others', async () => {
      api.results.openalex = [found('10.1/a', 'A', 'OpenAlex')];
      api.results.crossref = new Error('HTTP 503');

      const preview = await orchestrator.preview(projectId, { openalex: 'q', crossref: 'q' }, 50, 'relevance', 'q');

      expect(preview.breakdown.crossref).toEqual({ count: 0, error: 'HTTP 503' });
      expect(preview.results).toHaveLength(1);
    });

    it('keeps what a base returned before stopping and carries its warning to the summary', async () => {
      api.results.wos = [found('10.1/w', 'W', 'Web of Science')];
      api.warnings.wos = 'Web of Science: a busca parou em 1 de 100 resultados (Erro 429).';
      api.results.openalex = [found('10.1/a', 'A', 'OpenAlex')];

      const preview = await orchestrator.preview(projectId, { openalex: 'q', wos: 'q' }, 100, 'relevance', 'q');

      expect(preview.breakdown).toEqual({
        openalex: { count: 1 },
        wos: { count: 1, warning: 'Web of Science: a busca parou em 1 de 100 resultados (Erro 429).' },
      });
      expect(preview.results.map((r) => r.title).sort()).toEqual(['A', 'W']);
    });

    it('passes the stored Scopus and WoS keys to their APIs', async () => {
      db.setSetting('scopus_api_key', 'scopus-secret-key');
      db.setSetting('wos_api_key', 'wos-secret-key');

      await orchestrator.preview(projectId, { scopus: 'title("test")', wos: 'TS=test' }, 50, 'relevance', 'q');

      expect(api.calls).toEqual([
        { database: 'scopus', args: ['title("test")', 'scopus-secret-key', 'relevance', 50] },
        { database: 'wos', args: ['TS=test', 'wos-secret-key', 'relevance', 50] },
      ]);
    });
  });

  describe('savePreview', () => {
    it('saves the previewed articles and one history entry with sort and limit', async () => {
      api.results.openalex = [found('10.123/abc', 'Test Article', 'OpenAlex')];
      api.results.crossref = [found('10.123/abc', 'Test Article', 'Crossref')];
      const { previewId } = await orchestrator.preview(
        projectId,
        { openalex: 'q', crossref: 'q' },
        100,
        'citations',
        'title contains "test"',
      );

      const summary = orchestrator.savePreview(previewId);

      expect(summary).toEqual({ savedCount: 1, breakdown: { openalex: { count: 1 }, crossref: { count: 1 } } });
      const [article] = db.getArticlesByProject(projectId);
      expect(article.source_databases).toBe('["OpenAlex","Crossref"]');
      const [history] = db.getSearchHistory(projectId);
      expect([history.unified_query, history.sort_by, history.limit_val]).toEqual([
        'title contains "test"',
        'citations',
        100,
      ]);
      expect(article.search_id).toBe(history.id);
    });

    it('stores the query builder state with the history entry', async () => {
      const state = '{"ast":{"type":"rule"},"selectedDbs":["openalex"],"customQueries":{}}';
      const { previewId } = await orchestrator.preview(projectId, { openalex: 'q' }, 50, 'relevance', 'q', state);

      orchestrator.savePreview(previewId);

      const [history] = db.getSearchHistory(projectId) as { query_state: string | null }[];
      expect(history.query_state).toBe(state);
    });

    // The history says "N artigos salvos", and "Desfazer Busca" removes exactly the articles this search added.
    it('counts only the articles the search added, not the ones already in the project', async () => {
      db.saveArticle(projectId, {
        doi: '10.1/old',
        title: 'Old',
        source_query: 'q',
        source_databases: '[]',
        csl_json: '{}',
      });
      api.results.openalex = [found('10.1/old', 'Old', 'OpenAlex'), found('10.1/new', 'New', 'OpenAlex')];
      const { previewId } = await orchestrator.preview(projectId, { openalex: 'q' }, 50, 'relevance', 'q');

      const summary = orchestrator.savePreview(previewId);

      expect(summary.savedCount).toBe(1);
      expect((db.getSearchHistory(projectId) as { total_results: number }[])[0].total_results).toBe(1);
    });

    it('does not duplicate articles when the same search is saved twice', async () => {
      api.results.openalex = [found('10.5555/dup', 'Same Search Article', 'OpenAlex')];

      for (let run = 0; run < 2; run++) {
        const { previewId } = await orchestrator.preview(projectId, { openalex: 'q' }, 100, 'relevance', 'q');
        orchestrator.savePreview(previewId);
      }

      expect(db.getArticlesByProject(projectId)).toHaveLength(1);
    });

    it('refuses a preview that was already saved, naming the offending id', async () => {
      const { previewId } = await orchestrator.preview(projectId, { openalex: 'q' }, 50, 'relevance', 'q');
      orchestrator.savePreview(previewId);

      expect(() => orchestrator.savePreview(previewId)).toThrow(`previewId=${previewId}`);
    });
  });

  it('keeps the results for another try when saving fails', async () => {
    api.results.openalex = [found('10.1/a', 'A', 'OpenAlex')];
    const { previewId } = await orchestrator.preview(projectId, { openalex: 'q' }, 50, 'relevance', 'q');
    const saveHistory = vi.spyOn(db, 'saveSearchHistory').mockImplementationOnce(() => {
      throw new Error('SQLITE_BUSY');
    });

    expect(() => orchestrator.savePreview(previewId)).toThrow('SQLITE_BUSY');
    saveHistory.mockRestore();

    expect(orchestrator.savePreview(previewId).savedCount).toBe(1);
  });

  describe('discardPreview', () => {
    it('leaves the project untouched and makes the preview unsavable', async () => {
      api.results.openalex = [found('10.1/a', 'A', 'OpenAlex')];
      const { previewId } = await orchestrator.preview(projectId, { openalex: 'q' }, 50, 'relevance', 'q');

      orchestrator.discardPreview(previewId);

      expect(() => orchestrator.savePreview(previewId)).toThrow('Busca não encontrada');
      expect(db.getArticlesByProject(projectId)).toHaveLength(0);
      expect(db.getSearchHistory(projectId)).toHaveLength(0);
    });
  });

  it('covers complex title normalization (extra spaces, accents/diacritics, HTML tags, SQL special characters)', () => {
    expect(orchestrator.normalizeTitle('  Hello <i>World</i>!  ')).toBe(orchestrator.normalizeTitle('hello world!'));
    expect(orchestrator.normalizeTitle('Café e Ação')).toBe(orchestrator.normalizeTitle('cafe e acao'));
    expect(orchestrator.normalizeTitle("SELECT * FROM 'articles'; --")).toBe('select from articles');
  });
});

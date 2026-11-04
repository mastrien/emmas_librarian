import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiIntegrator } from '../ApiIntegrator';
import { QueryTranslator } from '../QueryTranslator';
import { SearchMonitorService } from '../SearchMonitorService';
import { SearchOrchestrator } from '../SearchOrchestrator';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import type { PagedResult } from '../searchApis/paginate';
import type { NormalizedArticle } from '../types';
import type { SearchHistoryItem } from '../../../src/types';

// Settings are encrypted with safeStorage; a reversible fake keeps the real SettingsRepository path.
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((str: string) => Buffer.from(`encrypted_${str}`)),
    decryptString: vi.fn((buf: Buffer) => buf.toString().replace('encrypted_', '')),
  },
}));

const work = (id: string): NormalizedArticle => ({
  doi: `10.1/${id}`,
  title: `Estudo ${id}`,
  authors: 'Silva',
  year: 2026,
  source_databases: ['OpenAlex'],
  csl_json: {},
});

/** Stands in for the bases: OpenAlex answers `works` (or fails), and every query is recorded. */
class FakeBases extends ApiIntegrator {
  works: NormalizedArticle[] = [];
  openAlexError: Error | null = null;
  queries: string[] = [];
  release: (() => void) | null = null;
  hold = false;

  override async searchOpenAlex(query: string): Promise<PagedResult> {
    this.queries.push(query);
    if (this.hold) await new Promise<void>((resolve) => (this.release = resolve));
    if (this.openAlexError) throw this.openAlexError;
    return { articles: this.works.map((w) => ({ ...w })), requests: 1, available: this.works.length };
  }

  override async searchScopus(query: string): Promise<PagedResult> {
    this.queries.push(query);
    return { articles: [], requests: 1 };
  }
}

const NOW = new Date('2026-11-02T12:00:00.000Z');
const DAY = 86_400_000;
const ast = { type: 'rule', field: 'title', operator: 'contains', value: 'radar' };

describe('SearchMonitorService (#52)', () => {
  let db: DatabaseAdapter;
  let bases: FakeBases;
  let orchestrator: SearchOrchestrator;
  let service: SearchMonitorService;
  let projectId: number;
  let searchId: number;

  beforeEach(() => {
    db = new DatabaseAdapter(':memory:');
    bases = new FakeBases();
    orchestrator = new SearchOrchestrator(db, new QueryTranslator(), bases);
    service = new SearchMonitorService(db, new QueryTranslator(), orchestrator);
    projectId = db.createProject('Revisão').id;
    searchId = saveSearch(['openalex']);
    db.searchMonitorRepo.setMonitor(searchId, 7);
  });

  function saveSearch(selectedDbs: string[]): number {
    const state = { ast, selectedDbs, customQueries: {}, limits: { common: 50, perBase: {} } };
    return db.saveSearchHistory(
      projectId,
      'Título contém "radar"',
      { openalex: 'old' },
      0,
      {},
      { queryState: JSON.stringify(state) },
    );
  }

  const onlyMonitor = () => db.searchMonitorRepo.listAll()[0];
  const history = () => db.getSearchHistory(projectId) as SearchHistoryItem[];
  const inProject = (id: string) =>
    db.saveArticle(projectId, { doi: `10.1/${id}`, title: `Estudo ${id}`, authors: 'S' } as never);

  it('says a search never checked is due, and one checked inside its interval is not', () => {
    expect(service.overview(NOW).dueCount).toBe(1);

    db.searchMonitorRepo.recordCheck(searchId, new Date(NOW.getTime() - 6 * DAY).toISOString(), 0, []);
    expect(service.overview(NOW).dueCount).toBe(0);

    db.searchMonitorRepo.recordCheck(searchId, new Date(NOW.getTime() - 7 * DAY).toISOString(), 0, []);
    expect(service.overview(NOW).dueCount).toBe(1);
  });

  it('runs only what is due', async () => {
    db.searchMonitorRepo.recordCheck(searchId, new Date(NOW.getTime() - DAY).toISOString(), 0, []);

    await service.checkDue(NOW);

    expect(bases.queries).toEqual([]);
  });

  it('counts what the project does not have, and says nothing when there is nothing', async () => {
    inProject('A');
    bases.works = [work('A'), work('B'), work('C')];

    expect((await service.checkDue(NOW)).notices).toMatchObject([
      { searchId, projectId, projectName: 'Revisão', query: 'Título contém "radar"', newCount: 2, failedBases: [] },
    ]);
    expect(onlyMonitor().last_checked_at).toBe(NOW.toISOString());

    bases.works = [work('A')];
    expect((await service.checkDue(new Date(NOW.getTime() + 8 * DAY))).notices).toEqual([]);
  });

  it('builds the query from the search, by publication date since the last check, with the margin', async () => {
    db.searchMonitorRepo.recordCheck(searchId, '2026-10-20T00:00:00.000Z', 0, []);

    await service.checkDue(NOW);

    expect(bases.queries).toHaveLength(1);
    expect(bases.queries[0]).toContain(',from_publication_date:2026-09-20');
    expect(bases.queries[0]).not.toContain('old');
  });

  it('looks from the day of the search itself on the first check', async () => {
    const [entry] = history();

    await service.checkDue(NOW);

    const margin = new Date(new Date(entry.created_at).getTime() - 30 * DAY);
    expect(bases.queries[0]).toContain(`from_publication_date:${margin.toISOString().slice(0, 10)}`);
  });

  it('reports a failed base and still advances when another answered', async () => {
    bases.openAlexError = new Error('429');
    db.setSetting('scopus_api_key', 'chave');
    db.searchMonitorRepo.setMonitor(searchId, null);
    const both = saveSearch(['openalex', 'scopus']);
    db.searchMonitorRepo.setMonitor(both, 7);

    const { notices } = await service.checkDue(NOW);

    expect(notices).toMatchObject([{ searchId: both, newCount: 0, failedBases: ['openalex'] }]);
    expect(onlyMonitor().last_checked_at).toBe(NOW.toISOString());
  });

  it('checks again next time when no base answered', async () => {
    bases.openAlexError = new Error('429');

    const { notices, dueCount } = await service.checkDue(NOW);

    expect(notices[0].failedBases).toEqual(['openalex']);
    expect(onlyMonitor().last_checked_at).toBeNull();
    expect(dueCount).toBe(1);
  });

  it('leaves out, and names, a base whose key is gone', async () => {
    db.searchMonitorRepo.setMonitor(searchId, null);
    const both = saveSearch(['openalex', 'scopus']);
    db.searchMonitorRepo.setMonitor(both, 7);

    const { notices } = await service.checkDue(NOW);

    expect(bases.queries).toHaveLength(1);
    expect(notices[0].failedBases).toEqual(['scopus']);
  });

  it('joins a check already running, so nothing runs twice', async () => {
    bases.hold = true;

    const first = service.checkDue(NOW);
    const second = service.checkDue(NOW);
    await vi.waitFor(() => expect(bases.release).not.toBeNull());
    bases.release?.();
    await Promise.all([first, second]);

    expect(bases.queries).toHaveLength(1);
  });

  it('records a search it cannot rebuild as checked, instead of failing every time', async () => {
    const legacy = db.saveSearchHistory(projectId, 'Importação', { import: 'x' }, 0, {});
    db.searchMonitorRepo.setMonitor(searchId, null);
    db.searchMonitorRepo.setMonitor(legacy, 7);

    expect((await service.checkDue(NOW)).notices).toEqual([]);
    expect(onlyMonitor().last_checked_at).toBe(NOW.toISOString());
    await expect(service.review(legacy, NOW)).rejects.toThrow(`searchId=${legacy}`);
  });

  // A search kept in an older format has no bases to read: found by the release tests, whose library has one.
  it('survives a search saved in an older format, and still checks the others', async () => {
    const old = db.saveSearchHistory(projectId, 'antiga', {}, 0, {}, { queryState: '{"groups":[]}' });
    db.searchMonitorRepo.setMonitor(old, 7);
    bases.works = [work('A')];

    const { notices } = await service.checkDue(NOW);

    expect(notices.map((n) => n.searchId)).toEqual([searchId]);
    expect(db.searchMonitorRepo.listAll().every((m) => m.last_checked_at === NOW.toISOString())).toBe(true);
  });

  it('checks the others when one search breaks, and tries that one again next time', async () => {
    const other = saveSearch(['openalex']);
    db.searchMonitorRepo.setMonitor(other, 7);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(orchestrator, 'fetchForMonitor').mockRejectedValueOnce(new Error('quebrou'));

    await service.checkDue(NOW);

    const checked = (id: number) => db.searchMonitorRepo.listAll().find((m) => m.search_id === id)?.last_checked_at;
    expect(checked(searchId)).toBeNull();
    expect(checked(other)).toBe(NOW.toISOString());
    expect(log).toHaveBeenCalledWith(expect.stringContaining('quebrou'));
    log.mockRestore();
  });

  describe('reviewing', () => {
    beforeEach(async () => {
      bases.works = [work('A'), work('B')];
      await service.checkDue(NOW);
    });

    it('saving makes a new entry told apart from the search, which stays monitored', async () => {
      const preview = await service.review(searchId, NOW);
      expect(preview.results.map((r) => r.title)).toEqual(['Estudo A', 'Estudo B']);

      expect(orchestrator.savePreview(preview.previewId).savedCount).toBe(2);

      const saved = history().find((h) => h.id !== searchId);
      expect(saved?.unified_query).toBe(`Monitoramento da busca #${searchId}: Título contém "radar"`);
      expect(JSON.parse(saved?.query_state ?? '{}').publishedSince).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(onlyMonitor()).toMatchObject({ search_id: searchId, pending_count: 0 });
    });

    it('discarding keeps those articles from alerting again, but a new one does', async () => {
      const preview = await service.review(searchId, NOW);

      orchestrator.discardPreview(preview.previewId);
      expect(service.overview(NOW).notices).toEqual([]);
      expect(history()).toHaveLength(1);

      const later = new Date(NOW.getTime() + 8 * DAY);
      expect((await service.checkDue(later)).notices).toEqual([]);

      bases.works = [work('A'), work('B'), work('C')];
      const muchLater = new Date(later.getTime() + 8 * DAY);
      expect((await service.checkDue(muchLater)).notices[0].newCount).toBe(1);
      expect((await service.review(searchId, muchLater)).results.map((r) => r.title)).toEqual(['Estudo C']);
    });

    it('rejects a search that is not monitored', async () => {
      await expect(service.review(9999, NOW)).rejects.toThrow('searchId=9999');
    });
  });
});

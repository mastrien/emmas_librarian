import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { QueryTranslator } from './QueryTranslator';
import type { SearchOrchestrator } from './SearchOrchestrator';
import {
  API_KEY_SETTINGS,
  buildFinalQueries,
  isKeyedDatabase,
  restoreSearch,
  type RestoredSearch,
} from '../../src/pages/Search/searchQueries';
import type { MonitorNotice, MonitorOverview, SearchHistoryItem, SearchMonitor, SearchPreview } from '../../src/types';
import { withPublishedSince } from '../../src/utils/publishedSince';
import { isMonitorDue, monitorResultQuery, monitorSinceDate } from '../../src/utils/searchMonitor';

/** What a monitored search sends, and the bases it had to leave out. */
interface MonitorRun {
  restored: RestoredSearch;
  queries: Record<string, string>;
  skippedBases: string[];
  since: string;
}

const noticeOf = (monitor: SearchMonitor): MonitorNotice => ({
  searchId: monitor.search_id,
  projectId: monitor.project_id,
  projectName: monitor.project_name,
  query: monitor.unified_query,
  newCount: monitor.pending_count,
  failedBases: monitor.failed_bases,
  checkedAt: monitor.last_checked_at,
});

/**
 * Checks the searches the person marked to monitor (#52), only while the app is open: each runs for real, by the
 * publication date since its last check, and what the project does not have and was not shown yet becomes a notice.
 * Nothing enters a project from here: reviewing opens the same preview as a search.
 *
 * @example const { notices } = await new SearchMonitorService(db, translator, orchestrator).checkDue(new Date());
 */
export class SearchMonitorService {
  private running: Promise<MonitorOverview> | null = null;

  constructor(
    private db: DatabaseAdapter,
    private translator: QueryTranslator,
    private orchestrator: SearchOrchestrator,
  ) {}

  /** What to tell the person now, and how many checks are due. */
  overview(now: Date): MonitorOverview {
    const monitors = this.db.searchMonitorRepo.listAll();
    return {
      dueCount: monitors.filter((m) => isMonitorDue(m, now)).length,
      notices: monitors.filter((m) => m.pending_count > 0 || m.failed_bases.length > 0).map(noticeOf),
    };
  }

  /** Runs what is due, one search at a time. A call during a check joins it, so nothing runs twice. */
  checkDue(now: Date): Promise<MonitorOverview> {
    this.running ??= this.checkAll(now).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async checkAll(now: Date): Promise<MonitorOverview> {
    for (const monitor of this.db.searchMonitorRepo.listAll().filter((m) => isMonitorDue(m, now))) {
      await this.checkOneSafely(monitor, now);
    }
    return this.overview(now);
  }

  // One search breaking must not keep the others from being checked, at every opening of the dashboard. It stays due,
  // so it is tried again next time.
  private async checkOneSafely(monitor: SearchMonitor, now: Date): Promise<void> {
    try {
      await this.checkOne(monitor, now);
    } catch (err) {
      console.error(
        JSON.stringify({ event: 'monitor_search_failed', searchId: monitor.search_id, error: String(err) }),
      );
    }
  }

  private async checkOne(monitor: SearchMonitor, now: Date): Promise<void> {
    const repo = this.db.searchMonitorRepo;
    const run = this.planRun(monitor, now);
    if (!run) return repo.recordCheck(monitor.search_id, now.toISOString(), 0, []);
    const { articles, breakdown } = await this.orchestrator.fetchForMonitor(run.queries, run.restored);
    const failed = Object.entries(breakdown)
      .filter(([, outcome]) => outcome.error)
      .map(([base]) => base);
    const allFailed = failed.length === Object.keys(breakdown).length;
    const seen = repo.seenKeys(monitor.search_id);
    const fresh = articles.filter(
      (a) =>
        !this.db.findDuplicateArticle(monitor.project_id, a.doi, a.title) && !seen.has(this.orchestrator.articleKey(a)),
    );
    repo.recordCheck(monitor.search_id, allFailed ? null : now.toISOString(), fresh.length, [
      ...failed,
      ...run.skippedBases,
    ]);
  }

  /**
   * Opens a monitored search in the preview, without what was already shown. Saving it makes a new history entry
   * named after the monitored search; discarding it keeps those articles from alerting again.
   *
   * @example const preview = await service.review(7, new Date());
   */
  async review(searchId: number, now: Date): Promise<SearchPreview> {
    const monitor = this.db.searchMonitorRepo.listAll().find((m) => m.search_id === searchId);
    const run = monitor && this.planRun(monitor, now);
    if (!monitor || !run) {
      throw new Error(
        `Busca monitorada não encontrada. Offending value: searchId=${searchId}. Expected shape: id de uma busca monitorada com consulta salva.`,
      );
    }
    return this.orchestrator.previewForMonitor({
      searchId,
      projectId: monitor.project_id,
      queries: run.queries,
      restored: run.restored,
      unifiedQuery: monitorResultQuery(searchId, monitor.unified_query),
      publishedSince: run.since,
    });
  }

  // The queries are built again from the builder state, not taken from the entry: those may carry an older date filter.
  private planRun(monitor: SearchMonitor, now: Date): MonitorRun | null {
    const entry = (this.db.getSearchHistory(monitor.project_id) as SearchHistoryItem[]).find(
      (h) => h.id === monitor.search_id,
    );
    const restored = entry && restoreSearch(entry);
    if (!entry || !restored) return null;
    const usable = restored.state.selectedDbs.filter(
      (db) => !isKeyedDatabase(db) || this.db.getSetting(API_KEY_SETTINGS[db]),
    );
    const built = buildFinalQueries(
      usable,
      restored.state.customQueries,
      this.translator.translate(restored.state.ast),
    );
    if ('invalidDatabase' in built) return null;
    const since = monitorSinceDate(monitor.last_checked_at ?? entry.created_at);
    return {
      restored,
      queries: withPublishedSince(built.queries, since, now.toISOString().slice(0, 10)),
      skippedBases: restored.state.selectedDbs.filter((db) => !usable.includes(db)),
      since,
    };
  }
}

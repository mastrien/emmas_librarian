import type Database from 'better-sqlite3';
import { MONITOR_INTERVALS, type MonitorInterval } from '../../src/utils/searchMonitor';
import type { SearchMonitor } from '../../src/types';

type MonitorRow = Omit<SearchMonitor, 'failed_bases'> & { failed_bases: string };

const SELECT_MONITOR = `SELECT m.search_id, m.interval_days, m.last_checked_at, m.pending_count, m.failed_bases,
    h.project_id, p.name AS project_name, h.unified_query
  FROM search_monitors m
  JOIN search_history h ON h.id = m.search_id
  JOIN projects p ON p.id = h.project_id AND p.deleted_at IS NULL`;

function failedBasesOf(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

const toMonitor = (row: MonitorRow): SearchMonitor => ({ ...row, failed_bases: failedBasesOf(row.failed_bases) });

/**
 * Which searches the person chose to monitor (#52), when each was last checked, what that check found and what was
 * already shown, so an article set aside does not alert again. Rows hang on the history entry, so undoing the search
 * ends its monitoring. They do not travel in a project export: importing a project must not start spending the
 * quota of someone's API keys unasked.
 *
 * @example repo.setMonitor(7, 14); repo.listAll();
 */
export class SearchMonitorRepository {
  constructor(private db: Database.Database) {}

  /** Starts monitoring a search or changes its interval; null stops it. */
  setMonitor(searchId: number, intervalDays: MonitorInterval | null): void {
    if (intervalDays === null) {
      this.db.prepare('DELETE FROM search_monitors WHERE search_id = ?').run(searchId);
      return;
    }
    if (!MONITOR_INTERVALS.includes(intervalDays)) {
      throw new Error(
        `Intervalo inválido. Offending value: intervalDays=${intervalDays}. Expected shape: ${MONITOR_INTERVALS.join(', ')} ou null.`,
      );
    }
    this.db
      .prepare(
        `INSERT INTO search_monitors (search_id, interval_days) VALUES (?, ?)
         ON CONFLICT(search_id) DO UPDATE SET interval_days = excluded.interval_days`,
      )
      .run(searchId, intervalDays);
  }

  listByProject(projectId: number): SearchMonitor[] {
    return (this.db.prepare(`${SELECT_MONITOR} WHERE h.project_id = ?`).all(projectId) as MonitorRow[]).map(toMonitor);
  }

  /** Every monitor of a project that was not deleted. */
  listAll(): SearchMonitor[] {
    return (this.db.prepare(SELECT_MONITOR).all() as MonitorRow[]).map(toMonitor);
  }

  /** What a check found. `checkedAt` null keeps the last date: a check where no base answered did not happen. */
  recordCheck(searchId: number, checkedAt: string | null, pending: number, failedBases: string[]): void {
    this.db
      .prepare(
        `UPDATE search_monitors SET last_checked_at = COALESCE(?, last_checked_at), pending_count = ?, failed_bases = ?
         WHERE search_id = ?`,
      )
      .run(checkedAt, pending, JSON.stringify(failedBases), searchId);
  }

  /** Clears the notice, until the next check finds something. */
  clearNotice(searchId: number): void {
    this.db
      .prepare("UPDATE search_monitors SET pending_count = 0, failed_bases = '[]' WHERE search_id = ?")
      .run(searchId);
  }

  seenKeys(searchId: number): Set<string> {
    const rows = this.db.prepare('SELECT article_key FROM search_monitor_seen WHERE search_id = ?').all(searchId) as {
      article_key: string;
    }[];
    return new Set(rows.map((r) => r.article_key));
  }

  markSeen(searchId: number, keys: string[]): void {
    const insert = this.db.prepare('INSERT OR IGNORE INTO search_monitor_seen (search_id, article_key) VALUES (?, ?)');
    this.db.transaction(() => keys.forEach((key) => insert.run(searchId, key)))();
  }
}

import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../../core/database/DatabaseAdapter';
import type { SearchMonitorService } from '../../../core/services/SearchMonitorService';
import type { MonitorInterval } from '../../../src/utils/searchMonitor';
import { handle, type IpcRegistrar } from './handle';

/**
 * Marking searches to monitor, and what the checks found (#52).
 *
 * Usage:
 *   registerSearchMonitorHandlers(ipcMain, db, monitors);
 */
export function registerSearchMonitorHandlers(
  ipc: IpcRegistrar,
  db: DatabaseAdapter,
  monitors: SearchMonitorService,
): void {
  const repo = db.searchMonitorRepo;
  handle(ipc, IpcChannel.SEARCH_MONITORS_LIST, (_e, projectId: number) => repo.listByProject(projectId));
  handle(
    ipc,
    IpcChannel.SEARCH_MONITOR_SET,
    (_e, projectId: number, searchId: number, days: MonitorInterval | null) => {
      repo.setMonitor(searchId, days);
      return repo.listByProject(projectId);
    },
  );
  handle(ipc, IpcChannel.SEARCH_MONITOR_OVERVIEW, () => monitors.overview(new Date()));
  handle(ipc, IpcChannel.SEARCH_MONITOR_CHECK, () => monitors.checkDue(new Date()));
  handle(ipc, IpcChannel.SEARCH_MONITOR_REVIEW, (_e, searchId: number) => monitors.review(searchId, new Date()));
  handle(ipc, IpcChannel.SEARCH_MONITOR_DISMISS, (_e, searchId: number) => repo.clearNotice(searchId));
}

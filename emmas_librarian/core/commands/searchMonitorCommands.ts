import { IpcChannel } from '../../src/types';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { SearchMonitorService } from '../services/SearchMonitorService';
import type { MonitorInterval } from '../../src/utils/searchMonitor';
import type { CommandRegistry } from './CommandRegistry';

/**
 * Marking searches to monitor, and what the checks found (#52).
 *
 * Usage:
 *   registerSearchMonitorCommands(commands, db, monitors);
 */
export function registerSearchMonitorCommands(
  commands: CommandRegistry,
  db: DatabaseAdapter,
  monitors: SearchMonitorService,
): void {
  const repo = db.searchMonitorRepo;
  commands.add(IpcChannel.SEARCH_MONITORS_LIST, (projectId: number) => repo.listByProject(projectId));
  commands.add(IpcChannel.SEARCH_MONITOR_SET, (projectId: number, searchId: number, days: MonitorInterval | null) => {
    repo.setMonitor(searchId, days);
    return repo.listByProject(projectId);
  });
  commands.add(IpcChannel.SEARCH_MONITOR_OVERVIEW, () => monitors.overview(new Date()));
  commands.add(IpcChannel.SEARCH_MONITOR_CHECK, () => monitors.checkDue(new Date()));
  commands.add(IpcChannel.SEARCH_MONITOR_REVIEW, (searchId: number) => monitors.review(searchId, new Date()));
  commands.add(IpcChannel.SEARCH_MONITOR_DISMISS, (searchId: number) => repo.clearNotice(searchId));
}

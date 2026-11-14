import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseAdapter } from '../../../core/database/DatabaseAdapter';
import { registerSearchMonitorHandlers } from '../handlers/searchMonitorHandlers';
import { IpcChannel } from '../../types';
import type { SearchMonitorService } from '../../../core/services/SearchMonitorService';
import { FakeIpcMain } from './fakes/FakeIpcMain';

vi.mock('electron', () => ({ safeStorage: {}, app: { isPackaged: false } }));

/** Records which monitoring calls reached the service; the service itself has its own tests. */
class FakeMonitorService {
  overview = vi.fn((_now: Date) => ({ dueCount: 1, notices: [] }));
  checkDue = vi.fn(async (_now: Date) => ({ dueCount: 0, notices: [] }));
  review = vi.fn(async (searchId: number, _now: Date) => ({ previewId: `p${searchId}` }));
}

describe('search monitor IPC handlers (#52)', () => {
  let ipc: FakeIpcMain;
  let db: DatabaseAdapter;
  let monitors: FakeMonitorService;
  let projectId: number;
  let searchId: number;

  beforeEach(() => {
    ipc = new FakeIpcMain();
    db = new DatabaseAdapter(':memory:');
    monitors = new FakeMonitorService();
    projectId = db.createProject('Revisão').id;
    searchId = db.saveSearchHistory(projectId, 'q', { openalex: 'q' }, 0, {});
    registerSearchMonitorHandlers(ipc, db, monitors as unknown as SearchMonitorService);
  });

  it('marks a search and answers with the project list, which also lists it', async () => {
    const marked = await ipc.invoke(IpcChannel.SEARCH_MONITOR_SET, projectId, searchId, 14);

    expect(marked).toMatchObject([{ search_id: searchId, interval_days: 14 }]);
    expect(await ipc.invoke(IpcChannel.SEARCH_MONITORS_LIST, projectId)).toEqual(marked);
    expect(await ipc.invoke(IpcChannel.SEARCH_MONITOR_SET, projectId, searchId, null)).toEqual([]);
  });

  it('asks the service with the current time', async () => {
    const before = Date.now();

    expect(await ipc.invoke(IpcChannel.SEARCH_MONITOR_OVERVIEW)).toEqual({ dueCount: 1, notices: [] });
    expect(await ipc.invoke(IpcChannel.SEARCH_MONITOR_CHECK)).toEqual({ dueCount: 0, notices: [] });
    expect(await ipc.invoke(IpcChannel.SEARCH_MONITOR_REVIEW, 7)).toEqual({ previewId: 'p7' });

    expect(monitors.overview.mock.calls[0][0].getTime()).toBeGreaterThanOrEqual(before);
    expect(monitors.checkDue.mock.calls[0][0].getTime()).toBeGreaterThanOrEqual(before);
    expect(monitors.review.mock.calls[0][1].getTime()).toBeGreaterThanOrEqual(before);
  });

  it('dismisses a notice', async () => {
    db.searchMonitorRepo.setMonitor(searchId, 7);
    db.searchMonitorRepo.recordCheck(searchId, '2026-11-01T00:00:00.000Z', 3, []);

    await ipc.invoke(IpcChannel.SEARCH_MONITOR_DISMISS, searchId);

    expect(db.searchMonitorRepo.listAll()[0].pending_count).toBe(0);
  });
});

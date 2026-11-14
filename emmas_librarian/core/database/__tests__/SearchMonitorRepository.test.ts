import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseAdapter } from '../DatabaseAdapter';

describe('SearchMonitorRepository (#52), on real SQLite', () => {
  let db: DatabaseAdapter;
  let projectId: number;
  let searchId: number;
  const repo = () => db.searchMonitorRepo;

  beforeEach(() => {
    db = new DatabaseAdapter(':memory:');
    projectId = db.createProject('Revisão').id;
    searchId = db.saveSearchHistory(projectId, 'q', { openalex: 'q' }, 0, {});
  });

  it('starts, changes and stops monitoring a search', () => {
    repo().setMonitor(searchId, 7);
    expect(repo().listByProject(projectId)).toMatchObject([
      {
        search_id: searchId,
        interval_days: 7,
        last_checked_at: null,
        pending_count: 0,
        failed_bases: [],
        project_id: projectId,
        project_name: 'Revisão',
        unified_query: 'q',
      },
    ]);

    repo().setMonitor(searchId, 14);
    expect(repo().listAll()).toHaveLength(1);
    expect(repo().listAll()[0].interval_days).toBe(14);

    repo().setMonitor(searchId, null);
    expect(repo().listAll()).toEqual([]);
  });

  it('lets a project monitor several searches', () => {
    const other = db.saveSearchHistory(projectId, 'r', { openalex: 'r' }, 0, {});
    repo().setMonitor(searchId, 1);
    repo().setMonitor(other, 7);

    expect(
      repo()
        .listByProject(projectId)
        .map((m) => m.search_id),
    ).toEqual([searchId, other]);
  });

  it('refuses an interval that is not offered, naming it', () => {
    expect(() => repo().setMonitor(searchId, 3 as never)).toThrow('intervalDays=3');
  });

  it('ends the monitoring and what it saw when the search is undone', () => {
    repo().setMonitor(searchId, 7);
    repo().markSeen(searchId, ['a']);

    db.revertSearch(searchId);

    expect(repo().listAll()).toEqual([]);
    expect(db.getDB().prepare('SELECT count(*) AS n FROM search_monitor_seen').get()).toEqual({ n: 0 });
  });

  it('does not check a project in the trash', () => {
    repo().setMonitor(searchId, 7);

    db.deleteProject(projectId);

    expect(repo().listAll()).toEqual([]);
  });

  it('records a check, keeping the last date when none is given', () => {
    repo().setMonitor(searchId, 7);

    repo().recordCheck(searchId, '2026-11-01T00:00:00.000Z', 3, ['scopus']);
    expect(repo().listAll()[0]).toMatchObject({
      last_checked_at: '2026-11-01T00:00:00.000Z',
      pending_count: 3,
      failed_bases: ['scopus'],
    });

    repo().recordCheck(searchId, null, 0, ['openalex']);
    expect(repo().listAll()[0]).toMatchObject({
      last_checked_at: '2026-11-01T00:00:00.000Z',
      failed_bases: ['openalex'],
    });
  });

  it('clears a notice without forgetting the date', () => {
    repo().setMonitor(searchId, 7);
    repo().recordCheck(searchId, '2026-11-01T00:00:00.000Z', 3, ['scopus']);

    repo().clearNotice(searchId);

    expect(repo().listAll()[0]).toMatchObject({
      last_checked_at: '2026-11-01T00:00:00.000Z',
      pending_count: 0,
      failed_bases: [],
    });
  });

  it('remembers what was seen, once each', () => {
    repo().setMonitor(searchId, 7);

    repo().markSeen(searchId, ['a', 'b']);
    repo().markSeen(searchId, ['b', 'c']);

    expect([...repo().seenKeys(searchId)].sort()).toEqual(['a', 'b', 'c']);
  });

  it('survives a malformed list of failed bases', () => {
    repo().setMonitor(searchId, 7);
    db.getDB().prepare("UPDATE search_monitors SET failed_bases = '{oops'").run();

    expect(repo().listAll()[0].failed_bases).toEqual([]);
  });
});

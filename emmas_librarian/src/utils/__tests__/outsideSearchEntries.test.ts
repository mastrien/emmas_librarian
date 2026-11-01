// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isOutsideSearchBreakdown } from '../outsideSearchEntries';
import { DatabaseAdapter } from '../../../electron/database/DatabaseAdapter';
import { registerArticleHandlers } from '../../../electron/ipc/handlers/articleHandlers';
import { IpcChannel } from '../../types';

vi.mock('electron', () => ({ dialog: { showSaveDialog: vi.fn() } }));

describe('isOutsideSearchBreakdown', () => {
  it.each([
    [{ Manual: { count: 1 } }, true],
    [{ import: { count: 3 } }, true],
    [{ openalex: { count: 10 } }, false],
    [{ openalex: { count: 10 }, Manual: { count: 1 } }, false],
    [{}, false],
  ])('%o → %s', (breakdown, expected) => {
    expect(isOutsideSearchBreakdown(breakdown)).toBe(expected);
  });
});

// The history entries the app writes for articles that did not come from a search must read as such, or the
// PRISMA diagram would count them as a database called "Manual" (#50).
describe('history entries written by the article handlers (#50)', () => {
  let db: DatabaseAdapter;
  let call: (channel: string, ...args: unknown[]) => unknown;

  beforeEach(() => {
    db = new DatabaseAdapter(':memory:');
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    registerArticleHandlers(
      { handle: (c: string, l: (...a: unknown[]) => unknown) => handlers.set(c, l) } as never,
      db,
    );
    call = (channel, ...args) => handlers.get(channel)!({}, ...args);
  });

  afterEach(() => db.close());

  const breakdowns = (projectId: number) =>
    (db.getSearchHistory(projectId) as { results_breakdown: string }[]).map(
      (s) => JSON.parse(s.results_breakdown) as Record<string, unknown>,
    );

  it('marks an article added by hand and a copy from another project as outside the searches', async () => {
    const project = db.createProject('Revisão').id;
    const source = db.createProject('Outro').id;
    const copied = db.saveArticle(source, { title: 'Radar', authors: '' } as never);

    await call(IpcChannel.ARTICLES_CREATE_MANUAL, project, { title: 'Avulso' });
    await call(IpcChannel.ARTICLES_IMPORT_FROM_PROJECT, source, project, [copied]);

    expect(breakdowns(project)).toHaveLength(2);
    expect(breakdowns(project).every(isOutsideSearchBreakdown)).toBe(true);
  });
});

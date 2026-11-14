// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isOutsideSearchBreakdown, outsideSearchIds } from '../outsideSearchEntries';
import { DatabaseAdapter } from '../../../core/database/DatabaseAdapter';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { registerArticleCommands } from '../../../core/commands/articleCommands';
import { CommandRegistry } from '../../../core/commands/CommandRegistry';
import { LibraryStorage } from '../../../core/services/LibraryStorage';
import { appPathsIn } from '../../../core/ports/AppPaths';
import { IpcChannel } from '../../types';

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

describe('outsideSearchIds', () => {
  it('picks the entries that only brought articles from outside the searches, and survives broken JSON', () => {
    const entry = (id: number, results_breakdown: string) => ({ id, results_breakdown }) as never;

    const ids = outsideSearchIds([
      entry(1, '{"openalex":{"count":3}}'),
      entry(2, '{"Manual":{"count":1}}'),
      entry(3, '{"import":{"count":2}}'),
      entry(4, 'não é JSON'),
    ]);

    expect([...ids]).toEqual([2, 3]);
  });
});

// The history entries the app writes for articles that did not come from a search must read as such, or the
// PRISMA diagram would count them as a database called "Manual" (#50).
describe('history entries written by the article commands (#50)', () => {
  let db: DatabaseAdapter;
  let userData: string;
  let call: (channel: string, ...args: unknown[]) => unknown;

  beforeEach(() => {
    db = new DatabaseAdapter(':memory:');
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-outside-'));
    const commands = new CommandRegistry();
    registerArticleCommands(commands, db, new LibraryStorage(db, appPathsIn(userData)));
    call = (channel, ...args) => commands.run(channel, ...args);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(userData, { recursive: true, force: true });
  });

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

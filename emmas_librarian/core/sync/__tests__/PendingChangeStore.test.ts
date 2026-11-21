import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ChangeLog } from '../ChangeLog';
import { PendingChangeStore } from '../PendingChangeStore';
import { RowExporter } from '../RowExporter';
import { installSyncSchema } from '../syncSchema';
import type { SyncOperation } from '../operations';

const SCHEMA = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');

let db: Database.Database;
let log: ChangeLog;
let store: PendingChangeStore;

beforeEach(() => {
  db = new Database(':memory:');
  db.exec(SCHEMA);
  db.exec('PRAGMA foreign_keys = ON');
  installSyncSchema(db);
  log = new ChangeLog(db);
  store = new PendingChangeStore(db, log, new RowExporter(db, log));
});

afterEach(() => db.close());

const run = (sql: string, ...params: (string | number)[]): number =>
  Number(db.prepare(sql).run(...params).lastInsertRowid);
const count = (table: string): number => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

let counter = 0;
function op(partial: Partial<SyncOperation> & Pick<SyncOperation, 'entity' | 'kind' | 'uuid'>): SyncOperation {
  counter += 1;
  return { opId: `op-${counter}`, deviceId: 'phone-1', fields: null, changedAt: '2026-11-21T09:00:00Z', ...partial };
}

function projectWithUuid(name = 'Review'): { id: number; uuid: string } {
  const id = run('INSERT INTO projects (name) VALUES (?)', name);
  return { id, uuid: log.uuidOf('projects', id) };
}

describe('stage', () => {
  it('stores operations without touching the library', () => {
    const project = projectWithUuid();
    store.stage([op({ entity: 'projects', kind: 'update', uuid: project.uuid, fields: { name: 'From phone' } })]);

    expect(store.listPending()).toHaveLength(1);
    expect(db.prepare('SELECT name FROM projects WHERE id = ?').get(project.id)).toEqual({ name: 'Review' });
  });

  it('ignores an operation it already has, so a retry after a dropped connection is harmless', () => {
    const operation = op({ entity: 'projects', kind: 'delete', uuid: 'u-1' });
    expect(store.stage([operation])).toBe(1);
    expect(store.stage([operation])).toBe(0);
    expect(store.listPending()).toHaveLength(1);
  });

  it('refuses a column the phone must not write, naming it', () => {
    const bad = op({ entity: 'articles', kind: 'insert', uuid: 'u-2', fields: { local_file_path: 'C:\\secret.pdf' } });
    expect(() => store.stage([bad])).toThrow('Column "local_file_path" is not writable on articles');
  });

  it('refuses an unknown entity or kind', () => {
    expect(() =>
      store.stage([{ ...op({ entity: 'projects', kind: 'insert', uuid: 'u' }), entity: 'settings' }]),
    ).toThrow('Unknown synced entity "settings"');
    expect(() => store.stage([{ ...op({ entity: 'projects', kind: 'insert', uuid: 'u' }), kind: 'drop' }])).toThrow(
      'kind must be one of',
    );
  });

  it('stores nothing when one operation of the batch is invalid', () => {
    const good = op({ entity: 'projects', kind: 'delete', uuid: 'u-3' });
    expect(() => store.stage([good, { nonsense: true }])).toThrow();
    expect(store.listPending()).toEqual([]);
  });
});

describe('listPending', () => {
  it('shows the row as it is now, for the review screen', () => {
    const project = projectWithUuid('Before');
    store.stage([op({ entity: 'projects', kind: 'update', uuid: project.uuid, fields: { name: 'After' } })]);
    expect(store.listPending()[0].current).toMatchObject({ name: 'Before' });
  });
});

describe('apply', () => {
  it('inserts a new article under the project the phone named by uuid, and binds the new uuid', () => {
    const project = projectWithUuid();
    store.stage([
      op({
        entity: 'articles',
        kind: 'insert',
        uuid: 'art-1',
        fields: { project_id: project.uuid, title: 'Made on the phone' },
      }),
    ]);

    const decided = store.apply(store.listPending().map((change) => change.operation.opId));

    expect(decided[0].status).toBe('applied');
    expect(db.prepare('SELECT project_id, title FROM articles').get()).toEqual({
      project_id: project.id,
      title: 'Made on the phone',
    });
    expect(log.localIdOf('articles', 'art-1')).toBeDefined();
  });

  it('applies a parent and its child sent in the same batch, parent first', () => {
    store.stage([
      op({ entity: 'projects', kind: 'insert', uuid: 'proj-new', fields: { name: 'Born on the phone' } }),
      op({ entity: 'articles', kind: 'insert', uuid: 'art-new', fields: { project_id: 'proj-new', title: 'A' } }),
    ]);
    const decided = store.apply(store.listPending().map((change) => change.operation.opId));
    expect(decided.map((d) => d.status)).toEqual(['applied', 'applied']);
  });

  it('applies only the chosen changes', () => {
    const project = projectWithUuid();
    store.stage([
      op({ opId: 'keep', entity: 'projects', kind: 'update', uuid: project.uuid, fields: { name: 'Chosen' } }),
      op({ opId: 'leave', entity: 'projects', kind: 'insert', uuid: 'other', fields: { name: 'Not chosen' } }),
    ]);
    store.apply(['keep']);
    expect(count('projects')).toBe(1);
    expect(store.listPending().map((change) => change.operation.opId)).toEqual(['leave']);
  });

  it('sends a deleted article to the trash instead of dropping the row', () => {
    const project = projectWithUuid();
    const article = run('INSERT INTO articles (project_id, title) VALUES (?, ?)', project.id, 'Old');
    store.stage([op({ entity: 'articles', kind: 'delete', uuid: log.uuidOf('articles', article) })]);

    store.apply(store.listPending().map((change) => change.operation.opId));

    expect(db.prepare('SELECT deleted_at FROM articles WHERE id = ?').get(article)).not.toEqual({ deleted_at: null });
  });

  it('keeps the old text of a diary page in the history when the phone writes the same day', () => {
    const project = projectWithUuid();
    run(
      "INSERT INTO project_diary (project_id, entry_date, content) VALUES (?, '2026-11-21', 'desktop text')",
      project.id,
    );
    store.stage([
      op({
        entity: 'project_diary',
        kind: 'insert',
        uuid: 'd-1',
        fields: { project_id: project.uuid, entry_date: '2026-11-21', content: 'phone text' },
      }),
    ]);

    store.apply(store.listPending().map((change) => change.operation.opId));

    expect(db.prepare('SELECT content FROM project_diary').get()).toEqual({ content: 'phone text' });
    expect(db.prepare('SELECT content FROM project_diary_history').get()).toEqual({ content: 'desktop text' });
  });

  it('marks a change skipped, with the reason, when its row is gone, and still applies the others', () => {
    const project = projectWithUuid();
    store.stage([
      op({ opId: 'gone', entity: 'projects', kind: 'update', uuid: 'never-existed', fields: { name: 'x' } }),
      op({ opId: 'fine', entity: 'projects', kind: 'update', uuid: project.uuid, fields: { name: 'Fine' } }),
    ]);

    const decided = store.apply(['gone', 'fine']);

    expect(decided[0]).toMatchObject({ opId: 'gone', status: 'skipped' });
    expect(decided[0].reason).toContain('never-existed');
    expect(decided[1].status).toBe('applied');
  });

  it('does not log applied changes as new local changes, so they are not sent back to the phone', () => {
    const project = projectWithUuid();
    const mark = log.latestSeq();
    store.stage([op({ entity: 'projects', kind: 'update', uuid: project.uuid, fields: { name: 'Applied' } })]);
    store.apply(store.listPending().map((change) => change.operation.opId));
    expect(log.readSince(mark)).toEqual([]);
  });
});

describe('reject and decidedFor', () => {
  it('leaves the library untouched and tells the phone to undo', () => {
    const project = projectWithUuid('Original');
    store.stage([
      op({ opId: 'r1', entity: 'projects', kind: 'update', uuid: project.uuid, fields: { name: 'Rejected' } }),
    ]);

    store.reject(['r1']);

    expect(db.prepare('SELECT name FROM projects WHERE id = ?').get(project.id)).toEqual({ name: 'Original' });
    expect(store.decidedFor('phone-1')).toEqual([{ opId: 'r1', status: 'rejected', reason: null }]);
  });

  it('cannot reject what was already applied', () => {
    const project = projectWithUuid();
    store.stage([op({ opId: 'a1', entity: 'projects', kind: 'update', uuid: project.uuid, fields: { name: 'Done' } })]);
    store.apply(['a1']);
    expect(store.reject(['a1'])).toEqual([]);
  });

  it('reports only the device asked about', () => {
    store.stage([op({ opId: 'x1', deviceId: 'phone-2', entity: 'projects', kind: 'delete', uuid: 'zz' })]);
    store.reject(['x1']);
    expect(store.decidedFor('phone-1')).toEqual([]);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { LocalLibrary, type LibraryClock } from '../LocalLibrary';
import type { SyncOperation } from '../../../../core/sync/operations';

class FixedClock implements LibraryClock {
  private counter = 0;
  public now(): string {
    return '2026-11-21T09:00:00.000Z';
  }
  public newUuid(): string {
    this.counter += 1;
    return `uuid-${this.counter}`;
  }
}

let library: LocalLibrary;
let changes = 0;

beforeEach(() => {
  changes = 0;
  library = new LocalLibrary(LocalLibrary.empty('phone-1', new FixedClock()).state, new FixedClock(), () => {
    changes += 1;
  });
});

const remote = (partial: Partial<SyncOperation> & Pick<SyncOperation, 'entity' | 'uuid'>): SyncOperation => ({
  opId: `r-${partial.uuid}`,
  deviceId: 'desktop',
  kind: 'insert',
  fields: {},
  changedAt: 't',
  ...partial,
});

function seedSyncedProject(): string {
  library.applyRemote([remote({ entity: 'projects', uuid: 'p-1', fields: { name: 'Review', deleted_at: null } })]);
  return 'p-1';
}

describe('applyRemote', () => {
  it('adds a row with a local numeric id and keeps the uuid', () => {
    seedSyncedProject();
    expect(library.rows('projects')).toMatchObject([{ id: 1, uuid: 'p-1', name: 'Review' }]);
  });

  it('updates a row it already has instead of duplicating it', () => {
    seedSyncedProject();
    library.applyRemote([remote({ entity: 'projects', uuid: 'p-1', kind: 'update', fields: { name: 'Renamed' } })]);
    expect(library.rows('projects')).toHaveLength(1);
    expect(library.rows('projects')[0].name).toBe('Renamed');
  });

  it('removes a row the computer deleted', () => {
    seedSyncedProject();
    library.applyRemote([remote({ entity: 'projects', uuid: 'p-1', kind: 'delete', fields: null })]);
    expect(library.rows('projects')).toEqual([]);
  });

  it('never queues what came from the computer', () => {
    seedSyncedProject();
    expect(library.hasPending()).toBe(false);
  });
});

describe('local changes on a project from the computer', () => {
  it('queues an insert with the parent named by uuid', () => {
    const project = seedSyncedProject();
    const row = library.create('project_diary', { project_id: project, entry_date: '2026-11-21', content: 'hi' });
    expect(library.pendingOperations()).toMatchObject([
      { kind: 'insert', entity: 'project_diary', uuid: row.uuid, fields: { project_id: 'p-1', content: 'hi' } },
    ]);
    expect(library.pendingOperations()[0].fields).not.toHaveProperty('id');
  });

  it('queues an update carrying the whole row', () => {
    const project = seedSyncedProject();
    library.update('projects', project, { name: 'Edited' });
    expect(library.pendingOperations()[0]).toMatchObject({
      kind: 'update',
      fields: { name: 'Edited', deleted_at: null },
    });
  });

  it('puts a deleted project in the trash locally and queues a delete with no fields', () => {
    const project = seedSyncedProject();
    library.remove('projects', project);
    expect(library.find('projects', project)?.deleted_at).toBe('2026-11-21T09:00:00.000Z');
    expect(library.pendingOperations()[0]).toMatchObject({ kind: 'delete', fields: null });
  });

  it('really removes a row of a table that has no trash', () => {
    const project = seedSyncedProject();
    const doc = library.create('project_documents', { project_id: project, title: 'Link' });
    library.remove('project_documents', doc.uuid);
    expect(library.rows('project_documents')).toEqual([]);
  });

  it('finds the project of a deep row, so an annotation on an article of the computer is queued too', () => {
    const project = seedSyncedProject();
    const article = library.create('articles', { project_id: project, title: 'A' });
    library.create('annotations', { article_id: article.uuid, content_markdown: 'note' });
    expect(library.pendingOperations()).toHaveLength(2);
  });
});

describe('own projects', () => {
  it('are never queued, nor are the rows inside them', () => {
    const own = library.createOwnProject('Ideas');
    const article = library.create('articles', { project_id: own.uuid, title: 'A' });
    library.update('articles', article.uuid, { title: 'B' });
    expect(library.hasPending()).toBe(false);
    expect(library.find('articles', article.uuid)?.title).toBe('B');
  });
});

describe('confirm and undo', () => {
  it('forgets a confirmed change and remembers its id to tell the computer', () => {
    const project = seedSyncedProject();
    library.update('projects', project, { name: 'Edited' });
    const [op] = library.pendingOperations();
    library.confirm([op.opId]);
    expect(library.hasPending()).toBe(false);
    expect(library.takeProcessed()).toEqual([op.opId]);
  });

  it('removes a row the computer refused to insert', () => {
    const project = seedSyncedProject();
    const row = library.create('project_diary', { project_id: project, entry_date: 'd', content: 'x' });
    library.undo(library.pendingOperations().map((op) => op.opId));
    expect(library.find('project_diary', row.uuid)).toBeUndefined();
  });

  it('puts back the old values of a refused update', () => {
    const project = seedSyncedProject();
    library.update('projects', project, { name: 'Edited' });
    library.undo(library.pendingOperations().map((op) => op.opId));
    expect(library.find('projects', project)?.name).toBe('Review');
  });

  it('brings back a refused delete, with its original id', () => {
    const project = seedSyncedProject();
    const doc = library.create('project_documents', { project_id: project, title: 'Link' });
    library.confirm(library.pendingOperations().map((op) => op.opId));
    library.remove('project_documents', doc.uuid);
    library.undo(library.pendingOperations().map((op) => op.opId));
    expect(library.find('project_documents', doc.uuid)?.id).toBe(doc.id);
  });

  it('undoes two refused changes to the same row back to the original, newest first', () => {
    const project = seedSyncedProject();
    library.update('projects', project, { name: 'One' });
    library.update('projects', project, { name: 'Two' });
    library.undo(library.pendingOperations().map((op) => op.opId));
    expect(library.find('projects', project)?.name).toBe('Review');
  });

  it('keeps what was not refused', () => {
    const project = seedSyncedProject();
    library.update('projects', project, { name: 'Kept' });
    library.create('project_diary', { project_id: project, entry_date: 'd', content: 'x' });
    const [keep, refuse] = library.pendingOperations();
    library.undo([refuse.opId]);
    expect(library.pendingOperations().map((op) => op.opId)).toEqual([keep.opId]);
    expect(library.find('projects', project)?.name).toBe('Kept');
  });
});

describe('bookkeeping', () => {
  it('tells the storage after every change', () => {
    const before = changes;
    seedSyncedProject();
    library.update('projects', 'p-1', { name: 'x' });
    expect(changes).toBeGreaterThan(before + 1);
  });

  it('refuses to change a row it does not have, naming it', () => {
    expect(() => library.update('projects', 'nope', {})).toThrow('No projects row with uuid "nope"');
  });

  it('stops listing processed decisions once the computer has been told', () => {
    const project = seedSyncedProject();
    library.update('projects', project, { name: 'x' });
    library.confirm([library.pendingOperations()[0].opId]);
    library.forgetProcessed(library.takeProcessed());
    expect(library.takeProcessed()).toEqual([]);
  });

  it('keeps the cursor of the computer’s change log', () => {
    library.setCursor(42);
    expect(library.state.cursor).toBe(42);
  });
});

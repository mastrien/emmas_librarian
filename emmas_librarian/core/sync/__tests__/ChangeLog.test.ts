import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ChangeLog } from '../ChangeLog';
import { installSyncSchema } from '../syncSchema';
import { syncedTable } from '../syncedTables';

const SCHEMA = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');

let db: Database.Database;
let log: ChangeLog;

beforeEach(() => {
  db = new Database(':memory:');
  db.exec(SCHEMA);
  db.prepare("INSERT INTO projects (name) VALUES ('Before sync')").run();
  installSyncSchema(db);
  log = new ChangeLog(db);
});

afterEach(() => db.close());

const addProject = (name: string): number =>
  Number(db.prepare('INSERT INTO projects (name) VALUES (?)').run(name).lastInsertRowid);

describe('installSyncSchema', () => {
  it('gives a uuid to rows that existed before sync was enabled', () => {
    expect(log.uuidOf('projects', 1)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('can run twice without duplicating uuids or triggers', () => {
    const before = log.uuidOf('projects', 1);
    installSyncSchema(db);
    expect(log.uuidOf('projects', 1)).toBe(before);
    const triggers = db
      .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%'")
      .get() as { n: number };
    expect(triggers.n).toBe(18);
  });

  it('does not log rows that existed before sync as changes', () => {
    expect(log.readSince(0)).toEqual([]);
  });
});

describe('ChangeLog.readSince', () => {
  it('reports insert, update and delete in order, by uuid', () => {
    const id = addProject('Review');
    db.prepare("UPDATE projects SET name = 'Review 2' WHERE id = ?").run(id);
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);

    const changes = log.readSince(0);

    expect(changes.map((change) => change.kind)).toEqual(['insert', 'update', 'delete']);
    expect(new Set(changes.map((change) => change.uuid)).size).toBe(1);
  });

  it('keeps the uuid of a deleted row, so the delete can be told to the phone as a tombstone', () => {
    const id = addProject('Gone');
    const uuid = log.uuidOf('projects', id);
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    expect(log.readSince(0).at(-1)).toMatchObject({ kind: 'delete', uuid });
  });

  it('returns only what is after the given position', () => {
    addProject('A');
    const mark = log.latestSeq();
    addProject('B');
    expect(log.readSince(mark)).toHaveLength(1);
  });

  it('captures the other synced tables, such as the diary', () => {
    const project = addProject('P');
    db.prepare("INSERT INTO project_diary (project_id, entry_date, content) VALUES (?, '2026-11-21', 'x')").run(
      project,
    );
    expect(log.readSince(0).map((change) => change.entity)).toEqual(['projects', 'project_diary']);
  });
});

describe('ChangeLog.whileApplying', () => {
  it('does not log writes that come from a remote device', () => {
    log.whileApplying(() => addProject('From the phone'));
    expect(log.readSince(0)).toEqual([]);
  });

  it('logs local writes again afterwards, even if the remote write threw', () => {
    expect(() =>
      log.whileApplying(() => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    addProject('Local');
    expect(log.readSince(0)).toHaveLength(1);
  });
});

describe('uuid lookups', () => {
  it('finds the local id again from the uuid', () => {
    const id = addProject('P');
    expect(log.localIdOf('projects', log.uuidOf('projects', id))).toBe(id);
  });

  it('binds a remote uuid to a local row', () => {
    const id = addProject('P');
    log.bindUuid('projects', id, 'remote-uuid-1');
    expect(log.localIdOf('projects', 'remote-uuid-1')).toBe(id);
  });

  it('refuses an entity that is not synced, naming it', () => {
    expect(() => log.uuidOf('settings' as never, 1)).toThrow('Unknown synced entity "settings"');
  });
});

describe('syncedTable', () => {
  it('lists the accepted entities in the error', () => {
    expect(() => syncedTable('api_keys')).toThrow(/expected one of: projects, articles/);
  });

  it('marks the desktop file path of an article as local-only', () => {
    expect(syncedTable('articles').localOnlyColumns).toContain('local_file_path');
  });
});

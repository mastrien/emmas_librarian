import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ChangeLog } from '../ChangeLog';
import { DesktopSyncEndpoint } from '../DesktopSyncEndpoint';
import { OperationBuilder } from '../OperationBuilder';
import { PendingChangeStore } from '../PendingChangeStore';
import { RowExporter } from '../RowExporter';
import { installSyncSchema } from '../syncSchema';
import type { SyncOperation } from '../operations';
import type { SecureChannel } from '../crypto/SecureChannel';

const SCHEMA = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');

/** The endpoint never touches the channel in `handle`, so the fake only has to exist. */
class UnusedChannel {}

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  db.exec(SCHEMA);
});

afterEach(() => db.close());

const run = (sql: string, ...params: unknown[]): number => Number(db.prepare(sql).run(...params).lastInsertRowid);

/** A library that existed before the user ever paired a phone. */
function seedExistingLibrary(): { project: number; article: number } {
  const project = run("INSERT INTO projects (name) VALUES ('Old')");
  const article = run(
    "INSERT INTO articles (project_id, title, local_file_path) VALUES (?, 'Paper', 'C:/secret/paper.pdf')",
    project,
  );
  run("INSERT INTO annotations (article_id, content_markdown) VALUES (?, 'note')", article);
  run("INSERT INTO highlights (article_id, color, position_data) VALUES (?, 'yellow', '{}')", article);
  run("INSERT INTO project_diary (project_id, entry_date, content) VALUES (?, '2026-11-01', 'day')", project);
  return { project, article };
}

function buildEndpoint(): DesktopSyncEndpoint {
  installSyncSchema(db);
  const log = new ChangeLog(db);
  const exporter = new RowExporter(db, log);
  const store = new PendingChangeStore(db, log, exporter);
  const builder = new OperationBuilder(log, exporter, 'desktop');
  return new DesktopSyncEndpoint(new UnusedChannel() as unknown as SecureChannel, log, builder, store, 'phone-1');
}

/** Plays a phone that keeps asking until the desktop has nothing more to say. */
function pullEverything(endpoint: DesktopSyncEndpoint): { rounds: SyncOperation[][] } {
  const rounds: SyncOperation[][] = [];
  let cursor = 0;
  for (let guard = 0; guard < 50; guard += 1) {
    const response = endpoint.handle({ cursor, operations: [], processed: [] });
    if (response.cursor === cursor) break;
    cursor = response.cursor;
    rounds.push(response.operations);
  }
  return { rounds };
}

describe('the first copy of the library to a phone', () => {
  it('brings what existed before sync was enabled, parents before children, never the local file path', () => {
    seedExistingLibrary();
    const first = buildEndpoint().handle({ cursor: 0, operations: [], processed: [] });

    expect(first.operations.map((op) => op.entity)).toEqual([
      'projects',
      'articles',
      'annotations',
      'highlights',
      'project_diary',
    ]);
    expect(first.operations.every((op) => op.kind === 'insert')).toBe(true);
    expect(JSON.stringify(first.operations)).not.toContain('secret');
  });

  it('is not repeated by a second install of the schema', () => {
    seedExistingLibrary();
    const endpoint = buildEndpoint();
    const first = endpoint.handle({ cursor: 0, operations: [], processed: [] });
    installSyncSchema(db);
    const again = endpoint.handle({ cursor: first.cursor, operations: [], processed: [] });
    expect(again.operations).toEqual([]);
  });

  it('spreads more than 500 existing rows over several rounds until nothing is left', () => {
    for (let i = 0; i < 1200; i += 1) run('INSERT INTO projects (name) VALUES (?)', `P${i}`);
    const { rounds } = pullEverything(buildEndpoint());
    expect(rounds.length).toBeGreaterThanOrEqual(3);
    expect(rounds.flat()).toHaveLength(1200);
    expect(new Set(rounds.flat().map((op) => op.uuid)).size).toBe(1200);
  });

  it('does not bring rows that were already in the trash', () => {
    const { article } = seedExistingLibrary();
    db.prepare('UPDATE articles SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(article);
    const entities = buildEndpoint()
      .handle({ cursor: 0, operations: [], processed: [] })
      .operations.map((op) => op.entity);
    expect(entities).not.toContain('articles');
  });

  it('still logs the tombstone of a row deleted after the first copy', () => {
    const project = run("INSERT INTO projects (name) VALUES ('Lonely')");
    const endpoint = buildEndpoint();
    const first = endpoint.handle({ cursor: 0, operations: [], processed: [] });
    db.prepare('DELETE FROM projects WHERE id = ?').run(project);
    const next = endpoint.handle({ cursor: first.cursor, operations: [], processed: [] });
    expect(next.operations).toMatchObject([{ entity: 'projects', kind: 'delete' }]);
  });
});

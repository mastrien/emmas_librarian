import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ChangeLog } from '../ChangeLog';
import { OperationBuilder } from '../OperationBuilder';
import { RowExporter } from '../RowExporter';
import { installSyncSchema } from '../syncSchema';

const SCHEMA = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');

let db: Database.Database;
let log: ChangeLog;
let builder: OperationBuilder;
let exporter: RowExporter;

beforeEach(() => {
  db = new Database(':memory:');
  db.exec(SCHEMA);
  installSyncSchema(db);
  log = new ChangeLog(db);
  exporter = new RowExporter(db, log);
  builder = new OperationBuilder(log, exporter, 'desktop-1');
});

afterEach(() => db.close());

const run = (sql: string, ...params: (string | number)[]): number =>
  Number(db.prepare(sql).run(...params).lastInsertRowid);
const addProject = (name: string): number => run('INSERT INTO projects (name) VALUES (?)', name);
const addArticle = (projectId: number, title: string): number =>
  run(
    "INSERT INTO articles (project_id, title, local_file_path) VALUES (?, ?, 'C:\\\\Users\\\\ana\\\\a.pdf')",
    projectId,
    title,
  );

describe('RowExporter', () => {
  it('replaces a reference to another row by that row’s uuid and drops the local id', () => {
    const project = addProject('P');
    const article = addArticle(project, 'Mindfulness');

    const fields = exporter.exportRow('articles', article);

    expect(fields).toMatchObject({ title: 'Mindfulness', project_id: log.uuidOf('projects', project) });
    expect(fields).not.toHaveProperty('id');
  });

  it('never exports the path of a file on this computer', () => {
    const article = addArticle(addProject('P'), 'A');
    expect(exporter.exportRow('articles', article)).not.toHaveProperty('local_file_path');
  });

  it('keeps an empty reference empty', () => {
    const article = addArticle(addProject('P'), 'A');
    const annotation = run('INSERT INTO annotations (article_id, content_markdown) VALUES (?, ?)', article, 'note');
    expect(exporter.exportRow('annotations', annotation)).toMatchObject({ highlight_id: null });
  });

  it('returns null for a row that no longer exists', () => {
    expect(exporter.exportRow('projects', 999)).toBeNull();
  });
});

describe('OperationBuilder', () => {
  it('sends one insert carrying the final state when a new row was changed again', () => {
    const project = addProject('Draft');
    db.prepare("UPDATE projects SET name = 'Final' WHERE id = ?").run(project);

    const operations = builder.build(log.readSince(0));

    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      kind: 'insert',
      entity: 'projects',
      deviceId: 'desktop-1',
      fields: { name: 'Final' },
    });
  });

  it('sends an update for a row the phone already knew', () => {
    const project = addProject('Known');
    const mark = log.latestSeq();
    db.prepare("UPDATE projects SET name = 'Renamed' WHERE id = ?").run(project);
    expect(builder.build(log.readSince(mark))[0]).toMatchObject({ kind: 'update', fields: { name: 'Renamed' } });
  });

  it('sends a delete as a tombstone with no fields', () => {
    const project = addProject('Known');
    const uuid = log.uuidOf('projects', project);
    const mark = log.latestSeq();
    db.prepare('DELETE FROM projects WHERE id = ?').run(project);
    expect(builder.build(log.readSince(mark))).toMatchObject([{ kind: 'delete', uuid, fields: null }]);
  });

  it('sends nothing for a row created and deleted inside the same batch', () => {
    const project = addProject('Fleeting');
    db.prepare('DELETE FROM projects WHERE id = ?').run(project);
    expect(builder.build(log.readSince(0))).toEqual([]);
  });

  it('gives every operation its own opId, so a retry can be recognised', () => {
    addProject('A');
    addProject('B');
    const ids = builder.build(log.readSince(0)).map((operation) => operation.opId);
    expect(new Set(ids).size).toBe(2);
  });
});

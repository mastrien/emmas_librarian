import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { copyRow, rowsOfProject, tableColumns } from '../rowCopy';

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  db.exec(`
    CREATE TABLE articles (id INTEGER PRIMARY KEY, project_id INTEGER, title TEXT, extra TEXT);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, article_id INTEGER, body TEXT);
  `);
});

afterEach(() => {
  db.close();
});

describe('tableColumns', () => {
  it('lists the columns of a table', () => {
    expect([...tableColumns(db, 'notes')]).toEqual(['id', 'article_id', 'body']);
  });
});

describe('copyRow', () => {
  it('drops the id and unknown columns, applies overrides and returns the new id', () => {
    db.prepare("INSERT INTO articles (id, title) VALUES (50, 'taken')").run();

    const newId = copyRow(db, 'articles', { id: 50, project_id: 1, title: 'T', gone: 'x' }, { project_id: 9 });

    expect(newId).not.toBe(50);
    expect(db.prepare('SELECT project_id, title, extra FROM articles WHERE id = ?').get(newId)).toEqual({
      project_id: 9,
      title: 'T',
      extra: null,
    });
  });
});

describe('rowsOfProject', () => {
  beforeEach(() => {
    db.exec(`
      INSERT INTO articles (id, project_id, title) VALUES (1, 7, 'a'), (2, 8, 'b');
      INSERT INTO notes (article_id, body) VALUES (1, 'mine'), (2, 'other');
    `);
  });

  it('selects rows by project id', () => {
    expect(rowsOfProject(db, 'articles', 7).map((r) => r.title)).toEqual(['a']);
  });

  it('selects rows through their article', () => {
    expect(rowsOfProject(db, 'notes', 7, 'article').map((r) => r.body)).toEqual(['mine']);
  });
});

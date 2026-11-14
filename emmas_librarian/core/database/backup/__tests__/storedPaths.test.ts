// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('electron', () => ({ safeStorage: {}, app: { getPath: () => os.tmpdir() } }));

import { DatabaseAdapter } from '../../DatabaseAdapter';
import { rebaseStoredPaths } from '../storedPaths';

let dir: string;
let adapter: DatabaseAdapter;
let storage: { pdfs: string; documents: string };

const db = () => adapter.getDB();
const articlePath = () =>
  (db().prepare('SELECT local_file_path FROM articles').get() as { local_file_path: string | null }).local_file_path;

function storedFile(folder: string, name: string): string {
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, name), name);
  return path.join(folder, name);
}

function articleAt(filePath: string | null): void {
  const project = db().prepare("INSERT INTO projects (name) VALUES ('P')").run().lastInsertRowid;
  db().prepare("INSERT INTO articles (project_id, title, local_file_path) VALUES (?, 'A', ?)").run(project, filePath);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-paths-'));
  storage = { pdfs: path.join(dir, 'pdfs'), documents: path.join(dir, 'docs') };
  adapter = new DatabaseAdapter(':memory:');
});

afterEach(() => {
  adapter.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('rebaseStoredPaths', () => {
  it('moves a missing path to the file with the same name in storage', () => {
    const local = storedFile(storage.pdfs, 'a.pdf');
    articleAt('C:\\Users\\antigo\\AppData\\Roaming\\emma\\storage\\pdfs\\a.pdf');

    expect(rebaseStoredPaths(db(), storage)).toBe(1);

    expect(articlePath()).toBe(local);
  });

  it('understands POSIX paths from a backup made on macOS or Linux', () => {
    const local = storedFile(storage.pdfs, 'a.pdf');
    articleAt('/Users/antigo/Library/Application Support/emma/storage/pdfs/a.pdf');

    rebaseStoredPaths(db(), storage);

    expect(articlePath()).toBe(local);
  });

  it('keeps a path that still exists, even outside storage', () => {
    storedFile(storage.pdfs, 'a.pdf');
    const elsewhere = storedFile(path.join(dir, 'outro'), 'a.pdf');
    articleAt(elsewhere);

    expect(rebaseStoredPaths(db(), storage)).toBe(0);

    expect(articlePath()).toBe(elsewhere);
  });

  it('keeps a missing path when storage has no file with that name, and ignores empty paths', () => {
    articleAt('/antigo/pdfs/sumiu.pdf');
    articleAt(null);

    expect(rebaseStoredPaths(db(), storage)).toBe(0);

    expect(db().prepare('SELECT local_file_path FROM articles ORDER BY id').all()).toEqual([
      { local_file_path: '/antigo/pdfs/sumiu.pdf' },
      { local_file_path: null },
    ]);
  });

  it('looks for documents in the documents folder, not in the PDFs one', () => {
    storedFile(storage.pdfs, 'd.pdf');
    const doc = storedFile(storage.documents, 'd.pdf');
    const project = db().prepare("INSERT INTO projects (name) VALUES ('P')").run().lastInsertRowid;
    db()
      .prepare("INSERT INTO project_documents (project_id, title, local_file_path) VALUES (?, 'D', '/antigo/d.pdf')")
      .run(project);

    rebaseStoredPaths(db(), storage);

    expect(db().prepare('SELECT local_file_path FROM project_documents').get()).toEqual({ local_file_path: doc });
  });
});

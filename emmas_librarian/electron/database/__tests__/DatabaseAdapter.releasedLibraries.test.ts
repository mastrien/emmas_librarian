import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseAdapter } from '../DatabaseAdapter';

vi.mock('electron', () => ({ safeStorage: {} }));

// Real databases written by released versions (see fixtures/README.md), not hand-made schemas.
const FIXTURES = path.join(__dirname, 'fixtures');

let workDir: string;
let dbPath: string;

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-released-'));
  dbPath = path.join(workDir, 'emma.db');
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

function restoreReleasedLibrary(fixture: string): void {
  const raw = new Database(dbPath);
  try {
    raw.exec(fs.readFileSync(path.join(FIXTURES, fixture), 'utf-8'));
  } finally {
    raw.close();
  }
}

function withUpgradedLibrary<T>(read: (db: DatabaseAdapter) => T): T {
  const db = new DatabaseAdapter(dbPath);
  try {
    return read(db);
  } finally {
    db.close();
  }
}

const articleByTitle = (db: DatabaseAdapter, title: string) =>
  db.getArticlesByProject(1).find((article) => article.title === title);

describe.each([['library_v1_1_11.sql'], ['library_v1_1_23.sql']])('upgrading %s', (fixture) => {
  beforeEach(() => restoreReleasedLibrary(fixture));

  it('opens with an intact database', () => {
    expect(withUpgradedLibrary((db) => db.checkIntegrity())).toBe(true);
  });

  it('keeps the project and its writing pad', () => {
    const project = withUpgradedLibrary((db) => ({ ...db.getProject(1), pad: db.getProjectWritingPad(1) }));

    expect(project).toMatchObject({ name: 'Revisão sistemática', pad: '# Rascunho' });
  });

  it('keeps both articles with their status, archive note and metadata', () => {
    const [open, quoted] = withUpgradedLibrary((db) => [
      articleByTitle(db, 'Artigo aberto'),
      articleByTitle(db, "Artigo com 'aspas'"),
    ]);

    expect(open).toMatchObject({
      doi: '10.1000/a',
      status: 'read',
      year: 2024,
      abstract: 'Resumo',
      journal: 'Revista',
    });
    expect(quoted).toMatchObject({ doi: '10.1000/b', status: 'archived', archive_note: 'fora do escopo' });
  });

  it('keeps open access and publisher', () => {
    const open = withUpgradedLibrary((db) => articleByTitle(db, 'Artigo aberto'));

    expect(open).toMatchObject({ is_oa: 1, publisher: 'Editora A' });
  });

  it('keeps the annotation, its highlight and the pending highlight', () => {
    const notes = withUpgradedLibrary((db) => {
      const articleId = articleByTitle(db, 'Artigo aberto')!.id;
      return {
        annotations: db.getAnnotations(articleId).map((a) => a.content_markdown),
        highlights: db.getHighlights(articleId).map((h) => [h.content_text, h.comment]),
        pending: db.getPendingHighlights(articleId).length,
      };
    });

    expect(notes).toEqual({
      annotations: ['## Nota\ncom acento: ção'],
      highlights: [['trecho destacado', '## Nota\ncom acento: ção']],
      pending: 1,
    });
  });

  it('keeps the diary, documents, search history, investigation and settings', () => {
    const rest = withUpgradedLibrary((db) => ({
      diary: db.getDiaryEntries(1).map((entry) => [entry.entry_date, entry.content]),
      documents: db.getProjectDocuments(1).map((doc) => doc.title),
      searches: db.getSearchHistory(1).length,
      investigations: db.getMassiveInvestigations(1).length,
      theme: db.getSetting('theme'),
    }));

    expect(rest).toEqual({
      diary: [['2026-06-01', 'Primeiro dia']],
      documents: ['Protocolo'],
      searches: 1,
      investigations: 1,
      theme: 'dark',
    });
  });

  it('keeps the category values set on each article', () => {
    const values = withUpgradedLibrary((db) =>
      db.getAllProjectArticleCategories(1).map((c) => [c.name, c.value ?? c.option_names?.join(',')]),
    );

    expect(values).toEqual(
      expect.arrayContaining([
        ['Método', 'Quantitativo'],
        ['Observação', 'revisar depois'],
      ]),
    );
  });

  it('opens again without changing anything the first upgrade wrote', () => {
    const dump = () =>
      withUpgradedLibrary((db) =>
        JSON.stringify([db.getArticlesByProject(1), db.getProjectCategories(1), db.getAllProjectArticleCategories(1)]),
      );

    expect(dump()).toBe(dump());
  });
});

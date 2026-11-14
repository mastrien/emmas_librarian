// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseAdapter } from '../DatabaseAdapter';

// A PDF can be shared: a copy from another project points at the same file, and the library stores one file
// per content. Deleting it from disk with one of its articles broke the others (#68). Real SQLite, temp files.
let db: DatabaseAdapter;
let dir: string;
let pdf: string;

beforeEach(() => {
  db = new DatabaseAdapter(':memory:');
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-shared-pdf-'));
  pdf = path.join(dir, 'radar.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4');
});

afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

let titles = 0;
function articleWithPdf(projectId: number, searchId: number | undefined, file = pdf): number {
  const id = db.saveArticle(projectId, { title: `Artigo ${++titles}`, authors: '', search_id: searchId } as never);
  db.updateArticleFilePath(id, file);
  return id;
}

const manualEntry = (projectId: number) => db.saveSearchHistory(projectId, 'm', {}, 1, { Manual: { count: 1 } });

describe('undoing a history entry and shared PDFs (#68)', () => {
  it('keeps the PDF of the source project when a copy of its article is undone', () => {
    const source = db.createProject('Origem').id;
    const original = articleWithPdf(source, undefined);
    const dest = db.createProject('Destino').id;
    const entry = db.saveSearchHistory(dest, 'Importação', { import: 'x' }, 1, { import: { count: 1 } });
    db.importArticlesFromProject(source, dest, [original], entry);

    db.revertSearch(entry);

    expect(db.getArticle(original)?.local_file_path).toBe(pdf);
    expect(fs.existsSync(pdf)).toBe(true);
  });

  it('keeps a PDF another article of the library still uses', () => {
    const project = db.createProject('P').id;
    const first = manualEntry(project);
    articleWithPdf(project, first);
    const kept = articleWithPdf(project, manualEntry(project));

    db.revertSearch(first);

    expect(db.getArticle(kept)?.local_file_path).toBe(pdf);
    expect(fs.existsSync(pdf)).toBe(true);
  });

  it('keeps a PDF an article in the trash still uses, since it can be restored', () => {
    const project = db.createProject('P').id;
    const first = manualEntry(project);
    articleWithPdf(project, first);
    db.deleteArticle(articleWithPdf(project, manualEntry(project)));

    db.revertSearch(first);

    expect(fs.existsSync(pdf)).toBe(true);
  });

  it('still deletes a PDF no other article uses', () => {
    const project = db.createProject('P').id;
    const entry = manualEntry(project);
    articleWithPdf(project, entry);

    db.revertSearch(entry);

    expect(fs.existsSync(pdf)).toBe(false);
  });
});

describe('other deletions of articles and shared PDFs (#68)', () => {
  it('deleting a project for good keeps the PDF a copy in another project uses', () => {
    const source = db.createProject('Origem').id;
    const other = db.createProject('Outro').id;
    articleWithPdf(source, undefined);
    const kept = articleWithPdf(other, undefined);

    db.deleteProjectPermanent(source);

    expect(db.getArticle(kept)?.local_file_path).toBe(pdf);
    expect(fs.existsSync(pdf)).toBe(true);
  });

  it('emptying an article from the trash keeps a PDF another article uses, and deletes an unused one', () => {
    const project = db.createProject('P').id;
    const trashed = articleWithPdf(project, undefined);
    articleWithPdf(project, undefined);
    const alone = path.join(dir, 'sozinho.pdf');
    fs.writeFileSync(alone, '%PDF-1.4');
    const lonely = articleWithPdf(project, undefined, alone);

    db.deleteTrashItemPermanent('article', trashed);
    db.deleteTrashItemPermanent('article', lonely);

    expect(fs.existsSync(pdf)).toBe(true);
    expect(fs.existsSync(alone)).toBe(false);
  });

  it('giving an article another PDF keeps the old one when another article uses it', () => {
    const project = db.createProject('P').id;
    const changed = articleWithPdf(project, undefined);
    articleWithPdf(project, undefined);
    const replacement = path.join(dir, 'nova.pdf');
    fs.writeFileSync(replacement, '%PDF-1.4');

    db.updateArticleFilePath(changed, replacement);

    expect(db.getArticle(changed)?.local_file_path).toBe(replacement);
    expect(fs.existsSync(pdf)).toBe(true);
  });
});

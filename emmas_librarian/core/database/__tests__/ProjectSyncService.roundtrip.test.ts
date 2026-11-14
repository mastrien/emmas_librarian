// AdmZip reads back empty entries under jsdom (Buffer/Uint8Array realm mismatch), so this suite runs in node.
// Choosing the file (dialogs, E2E variables) is the shell's part: electron/ipc/__tests__/backupHandlers.test.ts.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { seedFullProject, projectContent } from './support/fullProjectFixture';
import { expectFullProjectCopied } from './support/fullProjectAssertions';

import { DatabaseAdapter } from '../DatabaseAdapter';
import { ProjectSyncService } from '../ProjectSyncService';
import { appPathsIn } from '../../ports/AppPaths';

let workDir: string;
let userData: string;
let savePath: string;
let adapter: DatabaseAdapter;
let service: ProjectSyncService;

const db = () => adapter.getDB();
const one = (sql: string, ...params: unknown[]) =>
  db()
    .prepare(sql)
    .get(...params) as Record<string, unknown>;

function writeFile(name: string, content: string): string {
  const filePath = path.join(workDir, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

/** A .emmapcarc built by hand, as older app versions or other installations may have written it. */
function writeProjectFile(projectJson: object): string {
  const zip = new AdmZip();
  zip.addFile('project.json', Buffer.from(JSON.stringify(projectJson)));
  zip.writeZip(savePath);
  return savePath;
}

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-sync-'));
  userData = path.join(workDir, 'userData');
  savePath = path.join(workDir, 'projeto.emmapcarc');
  fs.mkdirSync(userData);
  adapter = new DatabaseAdapter(path.join(userData, 'emma.db'));
  service = new ProjectSyncService(adapter, appPathsIn(userData));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  adapter.close();
  vi.restoreAllMocks();
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('ProjectSyncService export → import round trip', () => {
  let original = 0;
  const roundTrip = async () => {
    const files = { pdfPath: writeFile('a.pdf', 'PDF-A'), docPath: writeFile('d.pdf', 'DOC-D') };
    original = seedFullProject(db(), files);
    await service.exportProject(original, savePath);
    return Number(await service.importProject(savePath));
  };

  it('keeps every value of every row of the project', async () => {
    const projectId = await roundTrip();

    expect(projectContent(db(), projectId)).toEqual(projectContent(db(), original));
  });

  it('imports the project as "<name> (Importado)" with every row and remapped foreign key', async () => {
    const projectId = await roundTrip();

    expect(one('SELECT name FROM projects WHERE id = ?', projectId).name).toBe('Tese (Importado)');
    expectFullProjectCopied(db(), projectId);
  });

  it('stores the imported PDF once and reuses it on the next import of the same file', async () => {
    const first = await roundTrip();
    const second = Number(await service.importProject(savePath));

    const pathOf = (projectId: number) =>
      String(
        one("SELECT local_file_path FROM articles WHERE project_id = ? AND title = 'A'", projectId).local_file_path,
      );
    expect(fs.readFileSync(pathOf(first), 'utf-8')).toBe('PDF-A');
    expect(path.dirname(pathOf(first))).toBe(path.join(userData, 'storage', 'pdfs'));
    expect(pathOf(second)).toBe(pathOf(first));
  });

  it('writes the format version first in project.json (#30)', async () => {
    await roundTrip();

    const projectJson = JSON.parse(new AdmZip(savePath).readAsText('project.json')) as object;
    expect(Object.entries(projectJson)[0]).toEqual(['formatVersion', 2]);
  });

  it('exports and restores project document files', async () => {
    const projectId = await roundTrip();

    const doc = one('SELECT local_file_path FROM project_documents WHERE project_id = ?', projectId);
    expect(fs.readFileSync(String(doc.local_file_path), 'utf-8')).toBe('DOC-D');
  });

  it('carries global question sets into the imported project', async () => {
    db().prepare("INSERT INTO question_sets (project_id, name, questions) VALUES (NULL, 'Global', '[]')").run();

    const projectId = await roundTrip();

    expect(
      one("SELECT project_id FROM question_sets WHERE name = 'Global' AND project_id IS NOT NULL").project_id,
    ).toBe(projectId);
  });
});

/** The smallest project.json older versions wrote: no category options, notes or question sets. */
const MINIMAL_PROJECT = {
  project: { id: 1, name: 'Velho' },
  articles: [{ id: 5, title: 'A', local_file_path: '/gone/a.pdf', created_at: 'x', updated_at: 'y' }],
  searchHistory: [],
  projectDocs: [{ id: 2, title: 'Link', url: 'http://x', local_file_path: null }],
  massiveInvs: [{ id: 3, questions: '[]', articles_ids: 'not json' }],
  projCategories: [],
  articleCategories: [{ article_id: 99, category_id: 98, value: 'orphan' }],
};

describe('ProjectSyncService importing hand-made or older files', () => {
  const minimal = MINIMAL_PROJECT;

  it('imports a file without the lists added in later versions and ignores unknown columns', async () => {
    const projectId = Number(await service.importProject(writeProjectFile(minimal)));

    expect(one('SELECT title, local_file_path FROM articles WHERE project_id = ?', projectId)).toEqual({
      title: 'A',
      local_file_path: null,
    });
    expect(one('SELECT url FROM project_documents WHERE project_id = ?', projectId).url).toBe('http://x');
  });

  it('keeps malformed investigation article ids as they were and skips rows linked to missing articles', async () => {
    const projectId = Number(await service.importProject(writeProjectFile(minimal)));

    expect(one('SELECT articles_ids FROM massive_investigations WHERE project_id = ?', projectId).articles_ids).toBe(
      'not json',
    );
    expect(db().prepare("SELECT * FROM article_categories WHERE value = 'orphan'").all()).toEqual([]);
  });

  it('imports answers from files made before the review existed as pending (#47)', async () => {
    const older = {
      ...minimal,
      investigationResults: [
        { id: 7, investigation_id: 3, article_id: 5, question: 'Q', answer: 'R', status: 'success' },
      ],
    };

    const projectId = Number(await service.importProject(writeProjectFile(older)));

    const sql = `SELECT r.answer, r.review_status, r.reviewed_answer FROM investigation_results r
      JOIN massive_investigations m ON m.id = r.investigation_id WHERE m.project_id = ?`;
    expect(one(sql, projectId)).toEqual({ answer: 'R', review_status: 'pending', reviewed_answer: null });
  });

  it('imports a file without formatVersion as format 1 (#30)', async () => {
    expect(minimal).not.toHaveProperty('formatVersion');

    const projectId = Number(await service.importProject(writeProjectFile(minimal)));

    expect(one('SELECT name FROM projects WHERE id = ?', projectId).name).toBe('Velho (Importado)');
  });

  it('refuses a file written in a newer format and imports nothing from it', async () => {
    const newer = writeProjectFile({ ...minimal, formatVersion: 99 });

    await expect(service.importProject(newer)).rejects.toThrow('formato 99');
    expect(one('SELECT COUNT(*) AS total FROM projects').total).toBe(0);
  });

  it('rejects an archive without project.json', async () => {
    const zip = new AdmZip();
    zip.addFile('other.txt', Buffer.from('x'));
    zip.writeZip(savePath);

    await expect(service.importProject(savePath)).rejects.toThrow('não contém project.json');
  });

  it('reports a target that cannot be written instead of announcing the export', async () => {
    fs.mkdirSync(savePath);
    const projectId = seedFullProject(db(), { pdfPath: writeFile('a.pdf', 'PDF'), docPath: writeFile('d.pdf', 'DOC') });

    await expect(service.exportProject(projectId, savePath)).rejects.toThrow();
  });

  it('reports the missing project id on export', async () => {
    await expect(service.exportProject(404, savePath)).rejects.toThrow('Projeto não encontrado (id 404)');
  });
});

describe('ProjectSyncService files on disk', () => {
  it('exports a project whose PDF is no longer on disk, without the file', async () => {
    const projectId = seedFullProject(db(), {
      pdfPath: path.join(workDir, 'sumiu.pdf'),
      docPath: writeFile('d.pdf', 'DOC'),
    });

    await service.exportProject(projectId, savePath);

    const names = new AdmZip(savePath).getEntries().map((e) => e.entryName);
    expect(names.sort()).toEqual(['docs/d.pdf', 'project.json']);
  });

  it('leaves no partial project behind when a row cannot be inserted', async () => {
    // question_sets.questions is NOT NULL: the last table imported fails after every other row went in.
    const file = writeProjectFile({ ...MINIMAL_PROJECT, questionSets: [{ id: 1, name: 'Sem perguntas' }] });

    await expect(service.importProject(file)).rejects.toThrow(/NOT NULL/);

    expect(db().prepare('SELECT name FROM projects').all()).toEqual([]);
    expect(db().prepare('SELECT title FROM articles').all()).toEqual([]);
  });
});

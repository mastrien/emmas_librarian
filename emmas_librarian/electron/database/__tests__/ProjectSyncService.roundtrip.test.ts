// AdmZip reads back empty entries under jsdom (Buffer/Uint8Array realm mismatch), so this suite runs in node.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { seedFullProject, expectFullProjectCopied } from './support/fullProjectFixture';

const electron = vi.hoisted(() => ({ userData: '', savePath: '' }));

vi.mock('electron', () => ({
  safeStorage: {},
  app: { getPath: () => electron.userData },
  dialog: {
    showSaveDialog: vi.fn(async () => ({ canceled: false, filePath: electron.savePath })),
    showOpenDialog: vi.fn(),
  },
}));

import { DatabaseAdapter } from '../DatabaseAdapter';
import { ProjectSyncService } from '../ProjectSyncService';

let workDir: string;
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
  zip.writeZip(electron.savePath);
  return electron.savePath;
}

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-sync-'));
  electron.userData = path.join(workDir, 'userData');
  electron.savePath = path.join(workDir, 'projeto.emmapcarc');
  fs.mkdirSync(electron.userData);
  adapter = new DatabaseAdapter(path.join(electron.userData, 'emma.db'));
  service = new ProjectSyncService(adapter);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  adapter.close();
  vi.restoreAllMocks();
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('ProjectSyncService export → import round trip', () => {
  const roundTrip = async () => {
    const files = { pdfPath: writeFile('a.pdf', 'PDF-A'), docPath: writeFile('d.pdf', 'DOC-D') };
    await service.exportProject(seedFullProject(db(), files));
    return Number(await service.importProject(electron.savePath));
  };

  it('imports the project as "<name> (Importado)" with every row and remapped foreign key', async () => {
    const projectId = await roundTrip();

    expect(one('SELECT name FROM projects WHERE id = ?', projectId).name).toBe('Tese (Importado)');
    expectFullProjectCopied(db(), projectId);
  });

  it('stores the imported PDF once and reuses it on the next import of the same file', async () => {
    const first = await roundTrip();
    const second = Number(await service.importProject(electron.savePath));

    const pathOf = (projectId: number) =>
      String(
        one("SELECT local_file_path FROM articles WHERE project_id = ? AND title = 'A'", projectId).local_file_path,
      );
    expect(fs.readFileSync(pathOf(first), 'utf-8')).toBe('PDF-A');
    expect(path.dirname(pathOf(first))).toBe(path.join(electron.userData, 'storage', 'pdfs'));
    expect(pathOf(second)).toBe(pathOf(first));
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

describe('ProjectSyncService importing hand-made or older files', () => {
  const minimal = {
    project: { id: 1, name: 'Velho' },
    articles: [{ id: 5, title: 'A', local_file_path: '/gone/a.pdf', created_at: 'x', updated_at: 'y' }],
    searchHistory: [],
    projectDocs: [{ id: 2, title: 'Link', url: 'http://x', local_file_path: null }],
    massiveInvs: [{ id: 3, questions: '[]', articles_ids: 'not json' }],
    projCategories: [],
    articleCategories: [{ article_id: 99, category_id: 98, value: 'orphan' }],
  };

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

  it('rejects an archive without project.json', async () => {
    const zip = new AdmZip();
    zip.addFile('other.txt', Buffer.from('x'));
    zip.writeZip(electron.savePath);

    await expect(service.importProject(electron.savePath)).rejects.toThrow('não contém project.json');
  });

  it('reports the missing project id on export', async () => {
    await expect(service.exportProject(404)).rejects.toThrow('Projeto não encontrado (id 404)');
  });
});

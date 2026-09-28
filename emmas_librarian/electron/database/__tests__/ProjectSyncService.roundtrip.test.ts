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

import { dialog } from 'electron';
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

  it('rejects an archive without project.json', async () => {
    const zip = new AdmZip();
    zip.addFile('other.txt', Buffer.from('x'));
    zip.writeZip(electron.savePath);

    await expect(service.importProject(electron.savePath)).rejects.toThrow('não contém project.json');
  });

  it('reports a target that cannot be written instead of announcing the export', async () => {
    fs.mkdirSync(electron.savePath);
    const projectId = seedFullProject(db(), { pdfPath: writeFile('a.pdf', 'PDF'), docPath: writeFile('d.pdf', 'DOC') });

    await expect(service.exportProject(projectId)).rejects.toThrow();
  });

  it('reports the missing project id on export', async () => {
    await expect(service.exportProject(404)).rejects.toThrow('Projeto não encontrado (id 404)');
  });
});

describe('ProjectSyncService file choice', () => {
  const pickProjectFile = (filePath: string | undefined) =>
    vi
      .mocked(dialog.showOpenDialog)
      .mockResolvedValueOnce({ canceled: !filePath, filePaths: filePath ? [filePath] : [] });

  it('writes nothing when the export dialog is cancelled', async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: true, filePath: '' });
    const projectId = seedFullProject(db(), { pdfPath: writeFile('a.pdf', 'PDF'), docPath: writeFile('d.pdf', 'DOC') });

    expect(await service.exportProject(projectId)).toBeNull();

    expect(fs.existsSync(electron.savePath)).toBe(false);
  });

  it('suggests a file named after the project id', async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: true, filePath: '' });

    await service.exportProject(7);

    expect(vi.mocked(dialog.showSaveDialog).mock.calls[0][0].defaultPath).toBe('projeto_7.emmapcarc');
  });

  it('exports a project whose PDF is no longer on disk, without the file', async () => {
    const projectId = seedFullProject(db(), {
      pdfPath: path.join(workDir, 'sumiu.pdf'),
      docPath: writeFile('d.pdf', 'DOC'),
    });

    await service.exportProject(projectId);

    const names = new AdmZip(electron.savePath).getEntries().map((e) => e.entryName);
    expect(names.sort()).toEqual(['docs/d.pdf', 'project.json']);
  });

  it('imports the file chosen in the open dialog and nothing when it is cancelled', async () => {
    const file = writeProjectFile({ ...MINIMAL_PROJECT, project: { id: 1, name: 'Escolhido' } });
    pickProjectFile(undefined);
    pickProjectFile(file);

    expect(await service.importProject()).toBeNull();
    const projectId = Number(await service.importProject());

    expect(one('SELECT name FROM projects WHERE id = ?', projectId).name).toBe('Escolhido (Importado)');
  });

  it('leaves no partial project behind when a row cannot be inserted', async () => {
    // question_sets.questions is NOT NULL: the last table imported fails after every other row went in.
    const file = writeProjectFile({ ...MINIMAL_PROJECT, questionSets: [{ id: 1, name: 'Sem perguntas' }] });

    await expect(service.importProject(file)).rejects.toThrow(/NOT NULL/);

    expect(db().prepare('SELECT name FROM projects').all()).toEqual([]);
    expect(db().prepare('SELECT title FROM articles').all()).toEqual([]);
  });
});

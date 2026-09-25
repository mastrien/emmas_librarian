// AdmZip reads back empty entries under jsdom (Buffer/Uint8Array realm mismatch), so this suite runs in node.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AdmZip from 'adm-zip';
import type Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { seedFullProject, expectFullProjectCopied } from './support/fullProjectFixture';

const electron = vi.hoisted(() => ({ userData: '' }));

vi.mock('electron', () => ({
  safeStorage: {},
  app: {
    getPath: () => electron.userData,
    getVersion: () => '9.9.9',
    relaunch: vi.fn(),
    exit: vi.fn(),
  },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
}));

import { DatabaseAdapter } from '../DatabaseAdapter';
import { BackupService } from '../BackupService';

let workDir: string;
let active: DatabaseAdapter;
let backupPath: string;

const run = (db: Database.Database, sql: string, ...params: unknown[]) =>
  Number(db.prepare(sql).run(...params).lastInsertRowid);
const one = (sql: string, ...params: unknown[]) =>
  active
    .getDB()
    .prepare(sql)
    .get(...params) as Record<string, unknown>;
const tempFolders = () => fs.readdirSync(electron.userData).filter((f) => f.startsWith('temp_restore_'));

/** A backup made by the app: a real emma.db plus stored files, zipped like exportBackup does. */
function createBackup(seed: (db: Database.Database) => void, files: Record<string, string> = {}): string {
  const sourceDir = fs.mkdtempSync(path.join(workDir, 'source-'));
  const source = new DatabaseAdapter(path.join(sourceDir, 'emma.db'));
  seed(source.getDB());
  source.checkpoint();
  source.close();
  const zip = new AdmZip();
  zip.addFile('emma.db', fs.readFileSync(path.join(sourceDir, 'emma.db')));
  for (const [entry, content] of Object.entries(files)) zip.addFile(entry, Buffer.from(content));
  const zipPath = path.join(workDir, 'backup.emmabak');
  zip.writeZip(zipPath);
  return zipPath;
}

const seed = (db: Database.Database) => {
  seedFullProject(db, { pdfPath: '/old/pdfs/a.pdf', docPath: '/old/docs/d.pdf' });
};

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-backup-'));
  electron.userData = path.join(workDir, 'userData');
  fs.mkdirSync(electron.userData);
  active = new DatabaseAdapter(path.join(electron.userData, 'emma.db'));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  active.close();
  vi.restoreAllMocks();
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('BackupService.restoreBackupMerge with real databases', () => {
  beforeEach(() => {
    backupPath = createBackup(seed, {
      'storage/pdfs/a.pdf': 'PDF-A',
      'storage/project_documents/d.pdf': 'DOC-D',
    });
  });

  const merge = () => new BackupService(active).restoreBackupMerge(backupPath);
  const mergedProjectId = () => Number(one("SELECT id FROM projects WHERE name = 'Tese'").id);

  it('imports the project with every row and remapped foreign key', async () => {
    expect(await merge()).toBe(1);

    expectFullProjectCopied(active.getDB(), mergedProjectId());
  });

  it('copies stored PDFs and documents into this installation', async () => {
    await merge();

    const article = one("SELECT local_file_path FROM articles WHERE title = 'A'");
    const doc = one("SELECT local_file_path FROM project_documents WHERE title = 'Edital'");
    expect(fs.readFileSync(String(article.local_file_path), 'utf-8')).toBe('PDF-A');
    expect(path.dirname(String(article.local_file_path))).toBe(path.join(electron.userData, 'storage', 'pdfs'));
    expect(fs.readFileSync(String(doc.local_file_path), 'utf-8')).toBe('DOC-D');
  });

  it('skips projects whose name already exists and leaves no temporary folder', async () => {
    run(active.getDB(), "INSERT INTO projects (name) VALUES ('Tese')");

    expect(await merge()).toBe(0);

    expect(active.getDB().prepare("SELECT id FROM projects WHERE name = 'Tese'").all()).toHaveLength(1);
    expect(tempFolders()).toEqual([]);
  });

  it('leaves the file path empty when the backup lacks the stored file', async () => {
    backupPath = createBackup(seed);

    await merge();

    expect(one("SELECT local_file_path FROM articles WHERE title = 'A'").local_file_path).toBeNull();
  });
});

describe('BackupService.restoreBackupMerge failures', () => {
  it('rejects a zip without emma.db and cleans up', async () => {
    const zip = new AdmZip();
    zip.addFile('other.txt', Buffer.from('x'));
    backupPath = path.join(workDir, 'bad.emmabak');
    zip.writeZip(backupPath);

    await expect(new BackupService(active).restoreBackupMerge(backupPath)).rejects.toThrow('não contém emma.db');
    expect(tempFolders()).toEqual([]);
  });

  it('logs but ignores a failure to close the backup database', async () => {
    backupPath = createBackup(() => undefined);
    const opener = (dbPath: string) => {
      const adapter = new DatabaseAdapter(dbPath);
      const close = adapter.close.bind(adapter);
      adapter.close = () => {
        close();
        throw new Error('busy');
      };
      return adapter;
    };

    expect(await new BackupService(active, opener).restoreBackupMerge(backupPath)).toBe(0);
    expect(console.error).toHaveBeenCalledWith('Erro ao fechar tempDb:', expect.any(Error));
  });
});

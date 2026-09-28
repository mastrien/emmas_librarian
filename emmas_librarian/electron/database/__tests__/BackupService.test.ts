// Real SQLite, real zip and a temp userData folder: the previous version mocked fs, adm-zip and better-sqlite3,
// so it could not tell what a backup contained or what a restore left on disk. The merge path has its own suite
// (BackupService.merge.test.ts). AdmZip reads back empty entries under jsdom, so this runs in node.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

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

import { app, dialog } from 'electron';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { BackupService } from '../BackupService';

let workDir: string;
let active: DatabaseAdapter;

const userPath = (...segments: string[]) => path.join(electron.userData, ...segments);
const run = (sql: string, ...params: unknown[]) =>
  Number(
    active
      .getDB()
      .prepare(sql)
      .run(...params).lastInsertRowid,
  );

/** Project names in a database file, opened outside the app's adapter. */
function projectNamesIn(file: string): string[] {
  const db = new Database(file, { readonly: true });
  try {
    return (db.prepare('SELECT name FROM projects ORDER BY name').all() as { name: string }[]).map((p) => p.name);
  } finally {
    db.close();
  }
}

function writeStoredFile(folder: 'pdfs' | 'project_documents', name: string, content: string): string {
  fs.mkdirSync(userPath('storage', folder), { recursive: true });
  const file = userPath('storage', folder, name);
  fs.writeFileSync(file, content);
  return file;
}

/** A .emmabak from another library whose only project is `name`, plus extra zip entries. */
function backupOf(name: string, entries: Record<string, string> = {}): string {
  const sourcePath = path.join(fs.mkdtempSync(path.join(workDir, 'source-')), 'emma.db');
  const source = new DatabaseAdapter(sourcePath);
  source.getDB().prepare('INSERT INTO projects (name) VALUES (?)').run(name);
  source.checkpoint();
  source.close();
  const zip = new AdmZip();
  zip.addFile('emma.db', fs.readFileSync(sourcePath));
  for (const [entry, content] of Object.entries(entries)) zip.addFile(entry, Buffer.from(content));
  const zipPath = path.join(workDir, `${name}.emmabak`);
  zip.writeZip(zipPath);
  return zipPath;
}

const saveTo = (filePath: string | undefined) =>
  vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: !filePath, filePath });
const openFile = (filePath: string | undefined) =>
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: !filePath, filePaths: filePath ? [filePath] : [] });

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-fullbackup-'));
  electron.userData = path.join(workDir, 'userData');
  fs.mkdirSync(electron.userData);
  active = new DatabaseAdapter(userPath('emma.db'));
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  try {
    active.close();
  } catch {
    // Restores close the active database themselves.
  }
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('BackupService.exportBackup', () => {
  const target = () => path.join(workDir, 'saida.emmabak');

  it('zips the database, stored PDFs and documents, and metadata counting live rows', async () => {
    const project = run("INSERT INTO projects (name) VALUES ('Tese')");
    run("INSERT INTO articles (project_id, title) VALUES (?, 'Vivo')", project);
    run("INSERT INTO articles (project_id, title, deleted_at) VALUES (?, 'Na lixeira', '2026-01-01')", project);
    writeStoredFile('pdfs', 'a.pdf', 'PDF-A');
    writeStoredFile('project_documents', 'd.pdf', 'DOC-D');
    saveTo(target());

    expect(await new BackupService(active).exportBackup()).toBe(target());

    const zip = new AdmZip(target());
    expect(zip.readAsText('storage/pdfs/a.pdf')).toBe('PDF-A');
    expect(zip.readAsText('storage/project_documents/d.pdf')).toBe('DOC-D');
    expect(JSON.parse(zip.readAsText('backup_metadata.json'))).toMatchObject({
      version: '9.9.9',
      projectCount: 1,
      articleCount: 1,
    });
    fs.writeFileSync(path.join(workDir, 'copy.db'), zip.getEntry('emma.db')!.getData());
    expect(projectNamesIn(path.join(workDir, 'copy.db'))).toEqual(['Tese']);
  });

  it('suggests a file named after the local date', async () => {
    saveTo(undefined);

    await new BackupService(active).exportBackup();

    expect(vi.mocked(dialog.showSaveDialog).mock.calls[0][0].defaultPath).toMatch(
      /^backup_\d{4}-\d{2}-\d{2}\.emmabak$/,
    );
  });

  it('writes nothing when the save dialog is cancelled', async () => {
    saveTo(undefined);

    expect(await new BackupService(active).exportBackup()).toBeNull();

    expect(fs.existsSync(target())).toBe(false);
  });

  it('writes to E2E_MOCK_SAVE_FILE_PATH without opening the save dialog', async () => {
    vi.stubEnv('E2E_MOCK_SAVE_FILE_PATH', target());

    expect(await new BackupService(active).exportBackup()).toBe(target());

    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
    expect(new AdmZip(target()).getEntry('emma.db')).not.toBeNull();
  });
  // AdmZip.writeZip returns silently when the target is a folder, so the app announced a backup it never wrote.
  it('reports a target that cannot be written (a folder with that name)', async () => {
    fs.mkdirSync(target());
    saveTo(target());

    await expect(new BackupService(active).exportBackup()).rejects.toThrow();

    expect(console.error).toHaveBeenCalledWith('Erro ao exportar backup:', expect.any(Error));
  });
});

describe('BackupService.restoreBackupOverride', () => {
  it('replaces the database and stored files, drops the old WAL and restarts', async () => {
    run("INSERT INTO projects (name) VALUES ('Atual')");
    const backup = backupOf('Do backup', {
      'storage/pdfs/a.pdf': 'PDF-A',
      'storage/project_documents/d.pdf': 'DOC-D',
    });

    expect(await new BackupService(active).restoreBackupOverride(backup)).toBe(true);

    expect(fs.existsSync(userPath('emma.db-wal'))).toBe(false);
    expect(projectNamesIn(userPath('emma.db'))).toEqual(['Do backup']);
    expect(fs.readFileSync(userPath('storage', 'pdfs', 'a.pdf'), 'utf8')).toBe('PDF-A');
    expect(fs.readFileSync(userPath('storage', 'project_documents', 'd.pdf'), 'utf8')).toBe('DOC-D');
    expect(app.relaunch).toHaveBeenCalled();
    expect(app.exit).toHaveBeenCalledWith(0);
  });

  it('only extracts the storage folders from the archive', async () => {
    const backup = backupOf('Do backup', { 'outra/coisa.txt': 'x' });

    await new BackupService(active).restoreBackupOverride(backup);

    expect(fs.existsSync(userPath('outra'))).toBe(false);
  });

  it('asks for the file and restores nothing when the dialog is cancelled', async () => {
    run("INSERT INTO projects (name) VALUES ('Atual')");
    openFile(undefined);

    expect(await new BackupService(active).restoreBackupOverride()).toBe(false);

    expect(active.getDB().prepare('SELECT name FROM projects').all()).toEqual([{ name: 'Atual' }]);
    expect(app.exit).not.toHaveBeenCalled();
  });

  it('restores the file chosen in the dialog', async () => {
    openFile(backupOf('Escolhido'));

    await new BackupService(active).restoreBackupOverride();

    expect(projectNamesIn(userPath('emma.db'))).toEqual(['Escolhido']);
  });

  it('uses E2E_MOCK_BACKUP_FILE instead of the open dialog', async () => {
    vi.stubEnv('E2E_MOCK_BACKUP_FILE', backupOf('Do E2E'));

    await new BackupService(active).restoreBackupOverride();

    expect(dialog.showOpenDialog).not.toHaveBeenCalled();
    expect(projectNamesIn(userPath('emma.db'))).toEqual(['Do E2E']);
  });

  it('rejects an archive without emma.db and keeps the current library open', async () => {
    run("INSERT INTO projects (name) VALUES ('Atual')");
    const zip = new AdmZip();
    zip.addFile('outro.txt', Buffer.from('x'));
    zip.writeZip(path.join(workDir, 'ruim.emmabak'));

    await expect(new BackupService(active).restoreBackupOverride(path.join(workDir, 'ruim.emmabak'))).rejects.toThrow(
      'Arquivo de backup inválido (não contém emma.db)',
    );

    expect(active.getDB().prepare('SELECT name FROM projects').all()).toEqual([{ name: 'Atual' }]);
    expect(app.exit).not.toHaveBeenCalled();
  });
});

describe('BackupService.restoreBackupMerge file choice', () => {
  it('uses E2E_MOCK_BACKUP_FILE instead of the open dialog', async () => {
    vi.stubEnv('E2E_MOCK_BACKUP_FILE', backupOf('Do E2E'));

    expect(await new BackupService(active).restoreBackupMerge()).toBe(1);

    expect(dialog.showOpenDialog).not.toHaveBeenCalled();
  });
});

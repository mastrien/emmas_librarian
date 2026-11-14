// Real SQLite, real zip and a temp userData folder: the previous version mocked fs, adm-zip and better-sqlite3,
// so it could not tell what a backup contained or what a restore left on disk. The merge path has its own suite
// (BackupService.merge.test.ts). AdmZip reads back empty entries under jsdom, so this runs in node.
// Choosing the file (dialogs, E2E variables) is the shell's part: electron/ipc/__tests__/exposeCommandsOverIpc.test.ts.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { DatabaseAdapter } from '../DatabaseAdapter';
import { BackupService } from '../BackupService';
import { appPathsIn } from '../../ports/AppPaths';
import { FakeAppRuntime } from '../../ports/__tests__/fakes/FakeAppRuntime';

let workDir: string;
let userData: string;
let active: DatabaseAdapter;
let runtime: FakeAppRuntime;

const backups = () => new BackupService(active, appPathsIn(userData), runtime);

const userPath = (...segments: string[]) => path.join(userData, ...segments);
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

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-fullbackup-'));
  userData = path.join(workDir, 'userData');
  fs.mkdirSync(userData);
  active = new DatabaseAdapter(userPath('emma.db'));
  runtime = new FakeAppRuntime();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  try {
    active.close();
  } catch {
    // Restores close the active database themselves.
  }
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

    expect(await backups().exportBackup(target())).toBe(target());

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

  // AdmZip.writeZip returns silently when the target is a folder, so the app announced a backup it never wrote.
  it('reports a target that cannot be written (a folder with that name)', async () => {
    fs.mkdirSync(target());

    await expect(backups().exportBackup(target())).rejects.toThrow();

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

    expect(await backups().restoreBackupOverride(backup)).toBe(true);

    expect(fs.existsSync(userPath('emma.db-wal'))).toBe(false);
    expect(projectNamesIn(userPath('emma.db'))).toEqual(['Do backup']);
    expect(fs.readFileSync(userPath('storage', 'pdfs', 'a.pdf'), 'utf8')).toBe('PDF-A');
    expect(fs.readFileSync(userPath('storage', 'project_documents', 'd.pdf'), 'utf8')).toBe('DOC-D');
    expect(runtime.restarts).toBe(1);
  });

  it('only extracts the storage folders from the archive', async () => {
    const backup = backupOf('Do backup', { 'outra/coisa.txt': 'x' });

    await backups().restoreBackupOverride(backup);

    expect(fs.existsSync(userPath('outra'))).toBe(false);
  });

  it('rejects an archive without emma.db and keeps the current library open', async () => {
    run("INSERT INTO projects (name) VALUES ('Atual')");
    const zip = new AdmZip();
    zip.addFile('outro.txt', Buffer.from('x'));
    zip.writeZip(path.join(workDir, 'ruim.emmabak'));

    await expect(backups().restoreBackupOverride(path.join(workDir, 'ruim.emmabak'))).rejects.toThrow(
      'Arquivo de backup inválido (não contém emma.db)',
    );

    expect(active.getDB().prepare('SELECT name FROM projects').all()).toEqual([{ name: 'Atual' }]);
    expect(runtime.restarts).toBe(0);
  });
});

describe('BackupService.restoreBackupOverride with a tampered archive', () => {
  // AdmZip strips "../" when writing, but keeps it when reading an archive made by another tool ("zip slip").
  function backupEscapingStorage(): string {
    // Rename by the whole entry name (same length): replacing a short marker also hit bytes of the compressed
    // emma.db at random and corrupted it.
    const clean = backupOf('Malicioso', { 'storage/pdfs/QQ/QQ/QQ/fora.txt': 'invasor' });
    const tampered = fs
      .readFileSync(clean)
      .toString('latin1')
      .split('storage/pdfs/QQ/QQ/QQ/fora.txt')
      .join('storage/pdfs/../../../fora.txt');
    fs.writeFileSync(clean, Buffer.from(tampered, 'latin1'));
    return clean;
  }

  it('refuses an entry that escapes the storage folders and leaves the library untouched', async () => {
    run("INSERT INTO projects (name) VALUES ('Atual')");

    await expect(backups().restoreBackupOverride(backupEscapingStorage())).rejects.toThrow(
      'storage/pdfs/../../../fora.txt',
    );

    expect(fs.existsSync(path.join(workDir, 'fora.txt'))).toBe(false);
    expect(active.getDB().prepare('SELECT name FROM projects').all()).toEqual([{ name: 'Atual' }]);
    expect(runtime.restarts).toBe(0);
  });
});

describe('BackupService.restoreBackupOverride on another computer', () => {
  // The database stores absolute paths (C:/Users/<name>/AppData/.../storage/pdfs/x.pdf). Restoring on another
  // machine or user account put the files in this userData folder but left every link pointing at the old one.
  it('points restored PDFs, documents and the PDF library at this installation', async () => {
    const oldUserData = userData;
    const pdf = writeStoredFile('pdfs', 'a.pdf', 'PDF-A');
    const doc = writeStoredFile('project_documents', 'd.pdf', 'DOC-D');
    const project = run("INSERT INTO projects (name) VALUES ('Tese')");
    run("INSERT INTO articles (project_id, title, local_file_path) VALUES (?, 'A', ?)", project, pdf);
    run("INSERT INTO project_documents (project_id, title, local_file_path) VALUES (?, 'Edital', ?)", project, doc);
    run("INSERT INTO pdf_files (file_path, file_hash, filename, file_size) VALUES (?, 'h1', 'a.pdf', 5)", pdf);
    const backup = path.join(workDir, 'outro-pc.emmabak');
    await backups().exportBackup(backup);
    active.close();
    fs.rmSync(oldUserData, { recursive: true, force: true });
    userData = path.join(workDir, 'novo-pc');
    fs.mkdirSync(userData);
    active = new DatabaseAdapter(userPath('emma.db'));

    await backups().restoreBackupOverride(backup);

    const restored = new Database(userPath('emma.db'), { readonly: true });
    const paths = [
      restored.prepare('SELECT local_file_path AS p FROM articles').get(),
      restored.prepare('SELECT local_file_path AS p FROM project_documents').get(),
      restored.prepare('SELECT file_path AS p FROM pdf_files').get(),
    ].map((row) => (row as { p: string }).p);
    restored.close();
    expect(paths).toEqual([
      userPath('storage', 'pdfs', 'a.pdf'),
      userPath('storage', 'project_documents', 'd.pdf'),
      userPath('storage', 'pdfs', 'a.pdf'),
    ]);
    expect(fs.readFileSync(paths[0], 'utf8')).toBe('PDF-A');
  });

  it('keeps links to files that are neither in the backup nor in this storage', async () => {
    const outside = path.join(workDir, 'fora.pdf');
    const project = run("INSERT INTO projects (name) VALUES ('Tese')");
    run("INSERT INTO articles (project_id, title, local_file_path) VALUES (?, 'A', ?)", project, outside);
    const backup = path.join(workDir, 'b.emmabak');
    await backups().exportBackup(backup);

    await backups().restoreBackupOverride(backup);

    const restored = new Database(userPath('emma.db'), { readonly: true });
    expect(restored.prepare('SELECT local_file_path FROM articles').get()).toEqual({ local_file_path: outside });
    restored.close();
  });
});

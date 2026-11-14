// Real files in a temp folder and real SQLite: the class exists to put bytes on disk and register them.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { appPathsIn, type AppPaths } from '../../ports/AppPaths';
import { LibraryStorage } from '../LibraryStorage';

let workDir: string;
let paths: AppPaths;
let db: DatabaseAdapter;
let storage: LibraryStorage;

const sourceFile = (name: string, content: string) => {
  const file = path.join(workDir, name);
  fs.writeFileSync(file, content);
  return file;
};

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-storage-'));
  paths = appPathsIn(path.join(workDir, 'userData'));
  db = new DatabaseAdapter(':memory:');
  storage = new LibraryStorage(db, paths);
});

afterEach(() => {
  db.close();
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('LibraryStorage folders', () => {
  it('creates the PDF and document folders of the library on first use', () => {
    expect(fs.existsSync(paths.pdfsDir)).toBe(false);

    expect(storage.pdfsDir()).toBe(paths.pdfsDir);
    expect(storage.documentsDir()).toBe(paths.documentsDir);

    expect(fs.statSync(paths.pdfsDir).isDirectory()).toBe(true);
    expect(fs.statSync(paths.documentsDir).isDirectory()).toBe(true);
  });
});

describe('LibraryStorage.savePdf', () => {
  it('copies the file into the PDF folder under a timestamped, sanitized name and registers it', () => {
    const stored = storage.savePdf(sourceFile('meu artigo (1).pdf', 'PDF-A'));

    expect(path.dirname(stored.destPath)).toBe(paths.pdfsDir);
    expect(stored.filename).toMatch(/^\d{4}-\d{2}-\d{2}_\d{6}_meu_artigo__1_\.pdf$/);
    expect(fs.readFileSync(stored.destPath, 'utf8')).toBe('PDF-A');
    expect(stored.size).toBe(5);
    expect(db.getPdfByHash(stored.hash)?.file_path).toBe(stored.destPath);
  });

  it('reuses the stored copy when the same content arrives under another name', () => {
    const first = storage.savePdf(sourceFile('a.pdf', 'MESMO'));

    const second = storage.savePdf(sourceFile('b.pdf', 'MESMO'));

    expect(second.destPath).toBe(first.destPath);
    expect(fs.readdirSync(paths.pdfsDir)).toHaveLength(1);
  });

  it('stores the file again when the registered copy is gone from disk', () => {
    const first = storage.savePdf(sourceFile('a.pdf', 'MESMO'));
    fs.unlinkSync(first.destPath);

    const second = storage.savePdf(sourceFile('c.pdf', 'MESMO'));

    expect(fs.readFileSync(second.destPath, 'utf8')).toBe('MESMO');
  });
});

describe('LibraryStorage.savePdfBytes', () => {
  it('writes downloaded bytes under the given name and registers them', () => {
    const stored = storage.savePdfBytes(Buffer.from('BYTES'), '10.2337_dc11-s062.pdf');

    expect(stored.filename).toMatch(/_10\.2337_dc11-s062\.pdf$/);
    expect(fs.readFileSync(stored.destPath, 'utf8')).toBe('BYTES');
    expect(db.getPdfByHash(stored.hash)?.file_size).toBe(5);
  });

  it('reuses a copy stored from a file with the same content', () => {
    const fromFile = storage.savePdf(sourceFile('a.pdf', 'MESMO'));

    expect(storage.savePdfBytes(Buffer.from('MESMO'), 'baixado.pdf').destPath).toBe(fromFile.destPath);
  });
});

// AdmZip reads back empty entries under jsdom (Buffer/Uint8Array realm mismatch), so this suite runs in node.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeArchive } from '../archiveFile';

let dir: string;
const zipWithNote = () => {
  const zip = new AdmZip();
  zip.addFile('nota.txt', Buffer.from('conteúdo'));
  return zip;
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-archive-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('writeArchive', () => {
  it('writes a zip that reads back with its entries', () => {
    writeArchive(zipWithNote(), path.join(dir, 'a.zip'));

    expect(new AdmZip(path.join(dir, 'a.zip')).readAsText('nota.txt')).toBe('conteúdo');
  });

  it('throws when the target is a folder', () => {
    fs.mkdirSync(path.join(dir, 'pasta.zip'));

    expect(() => writeArchive(zipWithNote(), path.join(dir, 'pasta.zip'))).toThrow();
  });
});

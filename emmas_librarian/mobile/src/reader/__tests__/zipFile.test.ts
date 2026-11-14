// @vitest-environment node
import { describe, it, expect } from 'vitest';
import AdmZip from 'adm-zip';
import { strToU8, zipSync } from 'fflate';
import { bytesSource, ZipFile, type ByteSource } from '../zipFile';

/** A source that counts what was read from it, to show that opening a zip does not read the whole file. */
class CountingSource implements ByteSource {
  bytesRead = 0;
  readonly size: number;

  constructor(private readonly bytes: Uint8Array) {
    this.size = bytes.length;
  }

  async read(start: number, end: number): Promise<Uint8Array> {
    this.bytesRead += end - start;
    return this.bytes.subarray(start, end);
  }
}

const text = (bytes: Uint8Array | null) => (bytes ? new TextDecoder().decode(bytes) : null);
// Incompressible, so the zip really is as big as the "PDF" inside it.
const noise = (length: number) => Uint8Array.from({ length }, (_unused, index) => (index * 2654435761) >>> 24);

describe('ZipFile', () => {
  it('lists the entries and reads each one, deflated or stored', async () => {
    const zipped = zipSync({
      'project.json': strToU8('{"project":{"name":"Tese"}}'),
      'pdfs/a.pdf': [strToU8('%PDF-1.4 sem compressão'), { level: 0 }],
    });

    const zip = await ZipFile.open(bytesSource(zipped));

    expect(zip.names().sort()).toEqual(['pdfs/a.pdf', 'project.json']);
    expect(text(await zip.read('project.json'))).toBe('{"project":{"name":"Tese"}}');
    expect(text(await zip.read('pdfs/a.pdf'))).toBe('%PDF-1.4 sem compressão');
  });

  it('answers null for an entry the zip does not have', async () => {
    const zip = await ZipFile.open(bytesSource(zipSync({ 'a.txt': strToU8('x') })));

    expect(await zip.read('pdfs/nada.pdf')).toBeNull();
  });

  it('reads archives written by the desktop (adm-zip), names with accents included', async () => {
    const desktop = new AdmZip();
    desktop.addFile('project.json', Buffer.from('{"ok":true}'));
    desktop.addFile('pdfs/revisão sistemática.pdf', Buffer.from('%PDF acentuado'));

    const zip = await ZipFile.open(bytesSource(new Uint8Array(desktop.toBuffer())));

    expect(text(await zip.read('project.json'))).toBe('{"ok":true}');
    expect(text(await zip.read('pdfs/revisão sistemática.pdf'))).toBe('%PDF acentuado');
  });

  // #193: a project with many PDFs must not be loaded whole to show its list of articles.
  it('opens and reads project.json touching a small part of a large archive, and a PDF only when asked', async () => {
    const pdf = noise(2_000_000);
    const source = new CountingSource(
      zipSync({ 'project.json': strToU8('{"articles":[]}'), 'pdfs/grande.pdf': [pdf, { level: 0 }] }),
    );

    const zip = await ZipFile.open(source);
    await zip.read('project.json');

    expect(source.size).toBeGreaterThan(2_000_000);
    expect(source.bytesRead).toBeLessThan(70_000);
    // Compared as buffers: a deep comparison of two million numbers takes seconds.
    const read = await zip.read('pdfs/grande.pdf');
    expect(Buffer.compare(Buffer.from(read!), Buffer.from(pdf))).toBe(0);
  });

  it.each([
    ['a file that is too short', new Uint8Array(10), 'tem só 10 bytes'],
    ['a file that is not a zip', noise(5000), 'não tem o registro final de um zip'],
  ])('refuses %s, saying what was expected', async (_label, bytes, problem) => {
    await expect(ZipFile.open(bytesSource(bytes))).rejects.toThrow(problem);
    await expect(ZipFile.open(bytesSource(bytes))).rejects.toThrow('esperado um arquivo zip');
  });

  it('refuses an entry packed with a method it does not read, naming it', async () => {
    const zipped = zipSync({ 'a.txt': strToU8('conteúdo') });
    // Compression method of the entry in the central directory (2 bytes at offset 10 of its header): 8 -> 99.
    const directory = zipped.findIndex(
      (_byte, at) => zipped[at] === 0x50 && zipped[at + 1] === 0x4b && zipped[at + 2] === 1,
    );
    zipped[directory + 10] = 99;

    const zip = await ZipFile.open(bytesSource(zipped));

    await expect(zip.read('a.txt')).rejects.toThrow('"a.txt" usa a compressão 99');
  });

  it('refuses a zip64 archive (over 4 GB) with a reason a person understands', async () => {
    const zipped = zipSync({ 'a.txt': strToU8('x') });
    // Offset of the central directory in the end record (4 bytes at offset 16) set to the zip64 marker.
    zipped.fill(0xff, zipped.length - 22 + 16, zipped.length - 22 + 20);

    await expect(ZipFile.open(bytesSource(zipped))).rejects.toThrow('mais de 4 GB');
  });
});

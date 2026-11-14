import { inflateSync } from 'fflate';

/** Something bytes can be read from in pieces, without holding all of it: a file on the phone, or a buffer. */
export interface ByteSource {
  size: number;
  /** The bytes from `start` (inclusive) to `end` (exclusive). */
  read(start: number, end: number): Promise<Uint8Array>;
}

/**
 * Bytes already in memory as a source (tests, small downloads).
 *
 * @example const source = bytesSource(new Uint8Array(buffer));
 */
export function bytesSource(bytes: Uint8Array): ByteSource {
  return { size: bytes.length, read: async (start, end) => bytes.subarray(start, end) };
}

/**
 * A file chosen on the device as a source: each read takes only that slice from storage, so a
 * project with hundreds of MB of PDFs is never loaded whole (#193).
 *
 * @example const source = fileSource(input.files[0]);
 */
export function fileSource(file: Blob): ByteSource {
  // FileReader rather than blob.arrayBuffer(): older mobile browsers (and the test DOM) lack the latter.
  const read = (start: number, end: number) =>
    new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(new Error(`Não foi possível ler o arquivo (bytes ${start} a ${end}).`));
      reader.readAsArrayBuffer(file.slice(start, end));
    });
  return { size: file.size, read };
}

interface ZipEntry {
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const END_SIGNATURE = 0x06054b50;
const ENTRY_SIGNATURE = 0x02014b50;
const END_MIN_SIZE = 22;
// The end record is followed only by an optional comment of at most 65535 bytes.
const END_SEARCH_SIZE = END_MIN_SIZE + 0xffff;
const ENTRY_HEADER_SIZE = 46;
const LOCAL_HEADER_SIZE = 30;
const ZIP64_MARK = 0xffffffff;
const STORED = 0;
const DEFLATED = 8;

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const notAZip = (detail: string) =>
  new Error(`Arquivo inválido: ${detail}; esperado um arquivo zip, como o .emmapcarc exportado pelo Emma's Librarian`);

function findEndRecord(tail: Uint8Array): DataView {
  const data = view(tail);
  for (let at = tail.length - END_MIN_SIZE; at >= 0; at -= 1) {
    if (data.getUint32(at, true) === END_SIGNATURE) return view(tail.subarray(at));
  }
  throw notAZip('não tem o registro final de um zip');
}

function parseEntries(directory: Uint8Array): Map<string, ZipEntry> {
  const entries = new Map<string, ZipEntry>();
  const data = view(directory);
  const decoder = new TextDecoder();
  let at = 0;
  while (at + ENTRY_HEADER_SIZE <= directory.length && data.getUint32(at, true) === ENTRY_SIGNATURE) {
    const nameLength = data.getUint16(at + 28, true);
    const name = decoder.decode(directory.subarray(at + ENTRY_HEADER_SIZE, at + ENTRY_HEADER_SIZE + nameLength));
    const entry = {
      method: data.getUint16(at + 10, true),
      compressedSize: data.getUint32(at + 20, true),
      localHeaderOffset: data.getUint32(at + 42, true),
    };
    entries.set(name, entry);
    at += ENTRY_HEADER_SIZE + nameLength + data.getUint16(at + 30, true) + data.getUint16(at + 32, true);
  }
  return entries;
}

function unpack(name: string, entry: ZipEntry, packed: Uint8Array): Uint8Array {
  if (entry.method === STORED) return packed;
  if (entry.method === DEFLATED) return inflateSync(packed);
  throw notAZip(
    `a entrada "${name}" usa a compressão ${entry.method}, e só 0 (sem compressão) e 8 (deflate) são lidas`,
  );
}

/**
 * A zip read by pieces: opening reads only its index (the last bytes of the file), and each entry is
 * read and unpacked when asked for. The wrapper this project owns around the zip format (fflate does
 * the inflating).
 *
 * Usage:
 *   const zip = await ZipFile.open(fileSource(file));
 *   const json = await zip.read('project.json'); // null when the zip has no such entry
 */
export class ZipFile {
  private constructor(
    private readonly source: ByteSource,
    private readonly entries: Map<string, ZipEntry>,
  ) {}

  static async open(source: ByteSource): Promise<ZipFile> {
    if (source.size < END_MIN_SIZE) throw notAZip(`tem só ${source.size} bytes`);
    const end = findEndRecord(await source.read(Math.max(0, source.size - END_SEARCH_SIZE), source.size));
    const size = end.getUint32(12, true);
    const offset = end.getUint32(16, true);
    if (offset === ZIP64_MARK || size === ZIP64_MARK) {
      throw notAZip('é um zip de mais de 4 GB (zip64), grande demais para abrir no celular');
    }
    return new ZipFile(source, parseEntries(await source.read(offset, offset + size)));
  }

  names(): string[] {
    return [...this.entries.keys()];
  }

  async read(name: string): Promise<Uint8Array | null> {
    const entry = this.entries.get(name);
    if (!entry) return null;
    // The local header repeats the name and may carry extra fields of its own length: the data follows them.
    const header = view(await this.source.read(entry.localHeaderOffset, entry.localHeaderOffset + LOCAL_HEADER_SIZE));
    const start = entry.localHeaderOffset + LOCAL_HEADER_SIZE + header.getUint16(26, true) + header.getUint16(28, true);
    return unpack(name, entry, await this.source.read(start, start + entry.compressedSize));
  }
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseAdapter } from '../../../database/DatabaseAdapter';
import { VectorStore } from '../../VectorStore';
import { ProjectIndexer, type PdfChunkReader } from '../ProjectIndexer';
import { FakeEmbedder } from './fakes';

vi.mock('electron', () => ({ safeStorage: {} }));

const MODEL = 'openai/atual';
const chunkOf = (text: string) => ({ text, page: 1, bbox: { x: 0, y: 0, w: 1, h: 1 } });

/** Reads "PDFs" from a list: a path it does not have is a missing file. */
class FakePdfReader {
  files: Record<string, string[]> = { 'a.pdf': ['texto a'], 'b.pdf': ['texto b'] };

  readonly read: PdfChunkReader = async (path) => {
    if (!this.files[path]) throw new Error(`Arquivo não encontrado: ${path}`);
    return this.files[path].map(chunkOf);
  };
}

describe('ProjectIndexer (#53)', () => {
  let adapter: DatabaseAdapter;
  let store: VectorStore;
  let pdfs: FakePdfReader;
  let projectId: number;

  beforeEach(() => {
    adapter = new DatabaseAdapter(':memory:');
    store = new VectorStore(adapter.getDB());
    pdfs = new FakePdfReader();
    projectId = adapter.createProject('Revisão').id;
  });

  const add = (title: string, pdf: string | null) =>
    Number(
      adapter
        .getDB()
        .prepare('INSERT INTO articles (project_id, title, local_file_path) VALUES (?, ?, ?)')
        .run(projectId, title, pdf).lastInsertRowid,
    );

  const indexer = (embedder = new FakeEmbedder()) =>
    new ProjectIndexer(store, adapter.pdfChunkIndexRepo, embedder, pdfs.read, MODEL);

  const chunkRows = () =>
    adapter.getDB().prepare('SELECT text_content AS t, embedding_model AS m FROM pdf_chunks').all();

  it('indexes the PDFs missing, recording the model, and says nothing else is', async () => {
    const a = add('A', 'a.pdf');
    const b = add('B', 'b.pdf');

    const { coverage, failed } = await indexer().indexMissing([a, b]);

    expect(failed).toEqual([]);
    expect(coverage.withoutIndex).toEqual([]);
    expect(coverage.indexed.map((article) => article.id)).toEqual([a, b]);
    expect(chunkRows()).toEqual([
      { t: 'texto a', m: MODEL },
      { t: 'texto b', m: MODEL },
    ]);
  });

  it('leaves alone what is indexed and what has no PDF', async () => {
    const a = add('A', 'a.pdf');
    const none = add('Sem PDF', null);
    const embedder = new FakeEmbedder();
    await indexer(embedder).indexMissing([a]);
    embedder.batches = [];

    const { coverage } = await indexer(embedder).indexMissing([a, none]);

    expect(embedder.batches).toEqual([]);
    expect(coverage.withoutPdf.map((article) => article.id)).toEqual([none]);
  });

  it('goes on after a PDF fails, naming it and why', async () => {
    const gone = add('Sumiu', 'sumiu.pdf');
    const a = add('A', 'a.pdf');

    const { coverage, failed } = await indexer().indexMissing([gone, a]);

    expect(failed).toEqual([{ title: 'Sumiu', reason: 'Arquivo não encontrado: sumiu.pdf' }]);
    expect(coverage.indexed.map((article) => article.id)).toEqual([a]);
    expect(coverage.withoutIndex.map((article) => article.id)).toEqual([gone]);
  });

  it('says when a PDF has no text', async () => {
    pdfs.files['scan.pdf'] = [];
    const scan = add('Scan', 'scan.pdf');

    expect((await indexer().indexMissing([scan])).failed[0].reason).toContain('digitalização');
  });

  it('reports a failure of the embedding provider as that PDF failing', async () => {
    const embedder = new FakeEmbedder();
    embedder.failOn = 'texto a';
    const a = add('A', 'a.pdf');

    expect((await indexer(embedder).indexMissing([a])).failed).toEqual([{ title: 'A', reason: 'provedor fora do ar' }]);
  });

  // The store clears the whole index when it receives vectors of another size.
  it('refuses a model of another size, keeping what is indexed', async () => {
    const a = add('A', 'a.pdf');
    const b = add('B', 'b.pdf');
    await indexer().indexMissing([a]);

    await expect(indexer(new FakeEmbedder([0, 0, 0])).indexMissing([a, b])).rejects.toThrow('2 dimensões');

    expect(chunkRows()).toEqual([{ t: 'texto a', m: MODEL }]);
    expect(store.indexedDimension()).toBe(2);
  });

  it('spends nothing when nothing is missing', async () => {
    const embedder = new FakeEmbedder();
    const none = add('Sem PDF', null);

    await indexer(embedder).indexMissing([none]);

    expect(embedder.calls).toEqual([]);
  });
});

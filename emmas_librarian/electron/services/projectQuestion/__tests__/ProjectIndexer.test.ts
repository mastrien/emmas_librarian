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

  describe('after the embedding model changes', () => {
    const OLD = 'openai/antigo';
    const seed = (articleId: number, text: string, model: string | null) =>
      store.indexArticleChunks(articleId, [chunkOf(text)], [[0, 0]], model);

    it('recalculates the PDFs of another model and of an unknown one, replacing what they had', async () => {
      const other = add('Outro', 'a.pdf');
      const older = add('Antigo', 'b.pdf');
      seed(other, 'velho a', OLD);
      seed(older, 'velho b', null);

      const { coverage } = await indexer().indexMissing([other, older]);

      expect(coverage.outdated).toEqual([]);
      expect(coverage.indexed.map((article) => article.id)).toEqual([other, older]);
      expect(chunkRows()).toEqual([
        { t: 'texto a', m: MODEL },
        { t: 'texto b', m: MODEL },
      ]);
    });

    it('keeps the old chunks of a PDF that fails, and it stays pending', async () => {
      const gone = add('Sumiu', 'sumiu.pdf');
      seed(gone, 'velho', OLD);

      const { coverage, failed } = await indexer().indexMissing([gone]);

      expect(failed).toHaveLength(1);
      expect(coverage.outdated.map((article) => article.id)).toEqual([gone]);
      expect(chunkRows()).toEqual([{ t: 'velho', m: OLD }]);
    });

    it('on a retry pays only for what is still pending', async () => {
      const a = add('A', 'a.pdf');
      const gone = add('Sumiu', 'sumiu.pdf');
      seed(a, 'velho a', OLD);
      seed(gone, 'velho b', OLD);
      const embedder = new FakeEmbedder();
      await indexer(embedder).indexMissing([a, gone]);
      pdfs.files['sumiu.pdf'] = ['texto b'];
      embedder.batches = [];

      await indexer(embedder).indexMissing([a, gone]);

      expect(embedder.batches).toEqual([['texto b']]);
    });

    it('leaves the PDFs outside the request as they were when the size is the same', async () => {
      const mine = add('Meu', 'a.pdf');
      const other = add('Outro', 'b.pdf');
      seed(mine, 'velho a', OLD);
      seed(other, 'velho b', OLD);

      await indexer().indexMissing([mine]);

      expect(chunkRows()).toEqual([
        { t: 'velho b', m: OLD },
        { t: 'texto a', m: MODEL },
      ]);
    });

    it('with another size, removes the rest of the library only when told to', async () => {
      const mine = add('Meu', 'a.pdf');
      const other = add('Outro', 'b.pdf');
      seed(mine, 'velho a', OLD);
      seed(other, 'velho b', OLD);
      const larger = () => indexer(new FakeEmbedder([0, 0, 0]));

      await expect(larger().indexMissing([mine])).rejects.toThrow('2 dimensões');
      expect(chunkRows()).toHaveLength(2);

      await larger().indexMissing([mine], true);

      expect(chunkRows()).toEqual([{ t: 'texto a', m: MODEL }]);
      expect(store.indexedDimension()).toBe(3);
    });

    it('with another size, removes nothing when the provider is down', async () => {
      const mine = add('Meu', 'a.pdf');
      seed(mine, 'velho a', OLD);
      const down = new FakeEmbedder([0, 0, 0]);
      down.failOn = 'texto a';

      const { failed } = await indexer(down).indexMissing([mine], true);

      expect(failed).toHaveLength(1);
      expect(chunkRows()).toEqual([{ t: 'velho a', m: OLD }]);
      expect(store.indexedDimension()).toBe(2);
    });

    describe('the plan', () => {
      it('counts what is pending, and spends nothing when nothing is', async () => {
        const embedder = new FakeEmbedder();
        const current = add('Atual', 'a.pdf');
        seed(current, 'atual', MODEL);

        const plan = await indexer(embedder).plan([current]);

        expect(plan).toEqual({
          pending: 0,
          outdated: 0,
          sizeChanged: false,
          othersLosingVectors: 0,
          previousModel: null,
        });
        expect(embedder.calls).toEqual([]);
      });

      it('says the others keep their vectors when the size is the same', async () => {
        const mine = add('Meu', 'a.pdf');
        const missing = add('Falta', 'b.pdf');
        const other = add('Outro', 'c.pdf');
        seed(mine, 'velho', OLD);
        seed(other, 'velho', OLD);

        expect(await indexer().plan([mine, missing])).toEqual({
          pending: 2,
          outdated: 1,
          sizeChanged: false,
          othersLosingVectors: 0,
          previousModel: OLD,
        });
      });

      it('names how many others lose their vectors when the size changes, changing nothing', async () => {
        const mine = add('Meu', 'a.pdf');
        const other = add('Outro', 'c.pdf');
        seed(mine, 'velho', OLD);
        seed(other, 'velho', OLD);

        const plan = await indexer(new FakeEmbedder([0, 0, 0])).plan([mine]);

        expect(plan).toEqual({
          pending: 1,
          outdated: 1,
          sizeChanged: true,
          othersLosingVectors: 1,
          previousModel: OLD,
        });
        expect(chunkRows()).toHaveLength(2);
      });

      it('names the model of the rest of the library when the PDFs asked about have none', async () => {
        const fresh = add('Novo', 'a.pdf');
        const other = add('Outro', 'c.pdf');
        seed(other, 'velho', OLD);

        const plan = await indexer(new FakeEmbedder([0, 0, 0])).plan([fresh]);

        expect(plan).toMatchObject({ outdated: 0, previousModel: OLD, othersLosingVectors: 1 });
      });

      it('asks the model nothing before the first indexing', async () => {
        const embedder = new FakeEmbedder();
        const a = add('A', 'a.pdf');

        expect((await indexer(embedder).plan([a])).sizeChanged).toBe(false);
        expect(embedder.calls).toEqual([]);
      });
    });
  });

  it('spends nothing when nothing is missing', async () => {
    const embedder = new FakeEmbedder();
    const none = add('Sem PDF', null);

    await indexer(embedder).indexMissing([none]);

    expect(embedder.calls).toEqual([]);
  });
});

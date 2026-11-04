import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseAdapter } from '../../../database/DatabaseAdapter';
import { VectorStore, type SimilarChunk } from '../../VectorStore';
import {
  assertSameVectorSize,
  pickSources,
  ProjectQuestionService,
  withoutCopies,
  type QuestionEmbedder,
} from '../ProjectQuestionService';
import { FakeAnswerModel, FakeEmbedder } from './fakes';

vi.mock('electron', () => ({ safeStorage: {} }));

const MODEL = 'openai/atual';

describe('ProjectQuestionService (#53)', () => {
  let adapter: DatabaseAdapter;
  let store: VectorStore;
  let model: FakeAnswerModel;
  let silva: number;
  let souza: number;
  let noIndex: number;
  let noPdf: number;

  beforeEach(() => {
    adapter = new DatabaseAdapter(':memory:');
    store = new VectorStore(adapter.getDB());
    model = new FakeAnswerModel();
    const projectId = adapter.createProject('Revisão').id;
    const insert = adapter
      .getDB()
      .prepare('INSERT INTO articles (project_id, title, authors, year, local_file_path) VALUES (?, ?, ?, ?, ?)');
    const add = (title: string, pdf: string | null) =>
      Number(insert.run(projectId, title, 'Autor', 2020, pdf).lastInsertRowid);
    silva = add('Silva', 'a.pdf');
    souza = add('Souza', 'b.pdf');
    noIndex = add('Sem índice', 'c.pdf');
    noPdf = add('Sem PDF', null);
    index(silva, 'silva diz', 4, 0.1);
    index(souza, 'souza diz', 9, 0.2);
  });

  function index(articleId: number, text: string, page: number, x: number): void {
    const chunk = { text, page, bbox: { x: 1, y: 2, w: 3, h: 4 } };
    store.indexArticleChunks(articleId, [chunk], [[x, 0]], MODEL);
  }

  const service = (embedder: QuestionEmbedder = new FakeEmbedder()) =>
    new ProjectQuestionService(store, adapter.pdfChunkIndexRepo, embedder, model.complete, MODEL);

  const all = () => [silva, souza, noIndex, noPdf];

  it('answers with each statement citing its article and page', async () => {
    model.answer = JSON.stringify({
      claims: [
        { text: 'A amostra varia.', sources: [1, 2] },
        { text: 'Só Souza mediu.', sources: [2] },
      ],
    });

    const answer = await service().ask('Qual a amostra?', all());

    expect(answer.question).toBe('Qual a amostra?');
    expect(answer.claims[0]).toMatchObject({ text: 'A amostra varia.', unverified: null });
    expect(answer.claims[0].citations).toEqual([
      {
        articleId: silva,
        title: 'Silva',
        authors: 'Autor',
        year: 2020,
        page: 4,
        bbox: { x: 1, y: 2, w: 3, h: 4 },
        text: 'silva diz',
        pdfPath: 'a.pdf',
      },
      {
        articleId: souza,
        title: 'Souza',
        authors: 'Autor',
        year: 2020,
        page: 9,
        bbox: { x: 1, y: 2, w: 3, h: 4 },
        text: 'souza diz',
        pdfPath: 'b.pdf',
      },
    ]);
    expect(answer.claims[1].citations.map((c) => c.articleId)).toEqual([souza]);
    expect(answer).toMatchObject({ chunksRead: 2, articlesRead: 2 });
  });

  it('reads only indexed articles, and says which were left out', async () => {
    const answer = await service().ask('Qual a amostra?', all());

    expect(model.prompts[0]).toContain('[T1] Silva, página 4\nsilva diz');
    expect(model.prompts[0]).toContain('[T2] Souza, página 9\nsouza diz');
    expect(model.prompts[0]).not.toContain('Sem índice');
    expect(answer.coverage.withoutIndex.map((a) => a.id)).toEqual([noIndex]);
    expect(answer.coverage.withoutPdf.map((a) => a.id)).toEqual([noPdf]);
  });

  it('keeps a statement citing a chunk it did not read, marked', async () => {
    model.answer = JSON.stringify({
      claims: [
        { text: 'conferida', sources: [1] },
        { text: 'inventada', sources: [3] },
      ],
    });

    const { claims } = await service().ask('Qual a amostra?', all());

    expect(claims[0]).toMatchObject({ text: 'conferida', unverified: null });
    expect(claims[1]).toMatchObject({
      text: 'inventada',
      citations: [],
      unverified: { kind: 'unknown_source', sources: ['3'], available: 2 },
    });
  });

  it('says nothing when the chunks do not answer, but says what it read', async () => {
    const answer = await service().ask('Qual a amostra?', all());

    expect(answer.claims).toEqual([]);
    expect(answer.chunksRead).toBe(2);
  });

  it('spends nothing when no article of the question is indexed', async () => {
    const embedder = new FakeEmbedder();

    const answer = await service(embedder).ask('Qual a amostra?', [noIndex, noPdf]);

    expect(answer).toMatchObject({ claims: [], chunksRead: 0 });
    expect(embedder.calls).toEqual([]);
    expect(model.prompts).toEqual([]);
  });

  it('blocks vectors of another size and never touches the index', async () => {
    const before = adapter.getDB().prepare('SELECT count(*) AS n FROM pdf_chunks').get();

    await expect(service(new FakeEmbedder([0, 0, 0])).ask('Qual a amostra?', all())).rejects.toThrow(
      'vetores de 2 dimensões e o modelo de embeddings atual gera 3',
    );

    expect(model.prompts).toEqual([]);
    expect(adapter.getDB().prepare('SELECT count(*) AS n FROM pdf_chunks').get()).toEqual(before);
    expect(store.indexedDimension()).toBe(2);
  });

  it('warns about what another model indexed, and still reads it', async () => {
    const other = adapter.getDB().prepare("INSERT INTO articles (project_id, title) VALUES (1, 'Outro modelo')").run();
    const otherId = Number(other.lastInsertRowid);
    store.indexArticleChunks(
      otherId,
      [{ text: 'outro diz', page: 1, bbox: { x: 0, y: 0, w: 1, h: 1 } }],
      [[0.3, 0]],
      'ollama/outro',
    );

    const answer = await service().ask('Qual a amostra?', [...all(), otherId]);

    expect(answer.coverage.otherModel.map((a) => a.id)).toEqual([otherId]);
    expect(model.prompts[0]).toContain('outro diz');
  });

  it('reads a chunk once when an article copied to another project has it twice', async () => {
    const copy = adapter.getDB().prepare("INSERT INTO articles (project_id, title) VALUES (1, 'Cópia')").run();
    const copyId = Number(copy.lastInsertRowid);
    index(copyId, 'silva diz', 4, 0.1);

    const answer = await service().ask('Qual a amostra?', [silva, copyId, souza]);

    expect(answer.chunksRead).toBe(2);
    expect(model.prompts[0].match(/silva diz/g)).toHaveLength(1);
  });

  it('continues a conversation: the search looks for the last question too, and the model sees the exchanges', async () => {
    const embedder = new FakeEmbedder();
    const turns = [
      { question: 'Primeira', answer: 'um' },
      { question: 'Qual a amostra?', answer: 'n = 30' },
    ];

    await service(embedder).ask('e no Silva?', all(), turns);

    expect(embedder.calls).toEqual(['Qual a amostra?\ne no Silva?']);
    expect(model.prompts[0]).toContain('Pergunta: Primeira\nResposta: um');
    expect(model.prompts[0]).toContain('PERGUNTA:\ne no Silva?');
  });

  it('reports the coverage without asking anything', () => {
    expect(service().coverage(all())).toMatchObject({ total: 4 });
    expect(model.prompts).toEqual([]);
  });
});

const chunk = (articleId: number, chunkId: number, text = String(chunkId)): SimilarChunk => ({
  chunkId,
  articleId,
  text,
  page: 1,
  bbox: { x: 0, y: 0, w: 0, h: 0 },
  similarityScore: chunkId,
});

describe('pickSources', () => {
  const fromTwo = [chunk(1, 1), chunk(1, 2), chunk(1, 3), chunk(2, 4), chunk(1, 5), chunk(2, 6)];

  it('stops one article from filling the answer', () => {
    expect(pickSources(fromTwo, 4, 2).map((c) => c.chunkId)).toEqual([1, 2, 4, 6]);
  });

  it('uses the room left when there are few articles', () => {
    expect(pickSources(fromTwo, 6, 2).map((c) => c.chunkId)).toEqual([1, 2, 4, 6, 3, 5]);
  });

  it('never passes the maximum', () => {
    expect(pickSources(fromTwo, 1, 5)).toHaveLength(1);
  });
});

describe('withoutCopies', () => {
  it('keeps the first of chunks with the same page and text', () => {
    expect(withoutCopies([chunk(1, 1, 'a'), chunk(2, 2, 'a'), chunk(2, 3, 'b')]).map((c) => c.chunkId)).toEqual([1, 3]);
  });

  it('keeps the same text on another page', () => {
    const other = { ...chunk(1, 2, 'a'), page: 2 };

    expect(withoutCopies([chunk(1, 1, 'a'), other])).toHaveLength(2);
  });
});

describe('assertSameVectorSize', () => {
  it('lets through what can be compared, and an index not created yet', () => {
    expect(() => assertSameVectorSize(4, 4)).not.toThrow();
    expect(() => assertSameVectorSize(null, 4)).not.toThrow();
  });

  it('refuses another size, naming both', () => {
    expect(() => assertSameVectorSize(1536, 768)).toThrow('1536 dimensões');
    expect(() => assertSameVectorSize(1536, 768)).toThrow('gera 768');
  });
});

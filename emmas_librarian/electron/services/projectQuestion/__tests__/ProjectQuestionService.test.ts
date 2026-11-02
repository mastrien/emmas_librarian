import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseAdapter } from '../../../database/DatabaseAdapter';
import { VectorStore, type SimilarChunk } from '../../VectorStore';
import { pickSources, ProjectQuestionService, type QuestionEmbedder } from '../ProjectQuestionService';

vi.mock('electron', () => ({ safeStorage: {} }));

const MODEL = 'openai/atual';

/** Gives every text the vector the test chose. */
class FakeEmbedder implements QuestionEmbedder {
  calls: string[] = [];
  constructor(private readonly vector: number[] = [0, 0]) {}

  async embed(text: string): Promise<number[]> {
    this.calls.push(text);
    return this.vector;
  }
}

/** The AI model: answers what the test chose and keeps the prompts. */
class FakeAnswerModel {
  prompts: string[] = [];
  constructor(public answer = '{"claims":[]}') {}

  readonly complete = async (prompt: string): Promise<string> => {
    this.prompts.push(prompt);
    return this.answer;
  };
}

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

    const answer = await service().ask('  Qual a amostra?  ', all());

    expect(answer.question).toBe('Qual a amostra?');
    expect(answer.claims[0].text).toBe('A amostra varia.');
    expect(answer.claims[0].citations).toEqual([
      {
        articleId: silva,
        title: 'Silva',
        authors: 'Autor',
        year: 2020,
        page: 4,
        bbox: { x: 1, y: 2, w: 3, h: 4 },
        text: 'silva diz',
      },
      {
        articleId: souza,
        title: 'Souza',
        authors: 'Autor',
        year: 2020,
        page: 9,
        bbox: { x: 1, y: 2, w: 3, h: 4 },
        text: 'souza diz',
      },
    ]);
    expect(answer.claims[1].citations.map((c) => c.articleId)).toEqual([souza]);
  });

  it('reads only indexed articles, and says which were left out', async () => {
    const answer = await service().ask('Qual a amostra?', all());

    expect(model.prompts[0]).toContain('[T1] Silva, página 4\nsilva diz');
    expect(model.prompts[0]).toContain('[T2] Souza, página 9\nsouza diz');
    expect(model.prompts[0]).not.toContain('Sem índice');
    expect(answer.coverage.withoutIndex.map((a) => a.id)).toEqual([noIndex]);
    expect(answer.coverage.withoutPdf.map((a) => a.id)).toEqual([noPdf]);
  });

  it('discards an answer citing a chunk it did not read, with a clear message', async () => {
    model.answer = '{"claims":[{"text":"inventado","sources":[3]}]}';

    await expect(service().ask('Qual a amostra?', all())).rejects.toThrow('não está entre os 2 recuperados');
  });

  it('says nothing when the chunks do not answer', async () => {
    const answer = await service().ask('Qual a amostra?', all());

    expect(answer.claims).toEqual([]);
    expect(answer.coverage.indexed).toHaveLength(2);
  });

  it('spends nothing when no article of the question is indexed', async () => {
    const embedder = new FakeEmbedder();

    const answer = await service(embedder).ask('Qual a amostra?', [noIndex, noPdf]);

    expect(answer.claims).toEqual([]);
    expect(embedder.calls).toEqual([]);
    expect(model.prompts).toEqual([]);
  });

  it('refuses an empty question, spending nothing', async () => {
    const embedder = new FakeEmbedder();

    await expect(service(embedder).ask('   ', all())).rejects.toThrow('Escreva a pergunta');
    expect(embedder.calls).toEqual([]);
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

  it('reports the coverage without asking anything', () => {
    expect(service().coverage(all())).toMatchObject({ total: 4 });
    expect(model.prompts).toEqual([]);
  });
});

describe('pickSources', () => {
  const chunk = (articleId: number, chunkId: number): SimilarChunk => ({
    chunkId,
    articleId,
    text: '',
    page: 1,
    bbox: { x: 0, y: 0, w: 0, h: 0 },
    similarityScore: chunkId,
  });
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

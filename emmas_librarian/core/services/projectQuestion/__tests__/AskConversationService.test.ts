import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseAdapter } from '../../../database/DatabaseAdapter';
import { VectorStore } from '../../VectorStore';
import { buildAskServices, pdfChunkReader, type AskServices } from '../askServices';
import { e2eAskModels } from '../e2eAskModels';
import { FakeAnswerModel, FakeEmbedder } from './fakes';

vi.mock('../../PdfExtractor', () => ({
  extractTextWithCoordinates: vi.fn(async (path: string, size: number, overlap: number) => ({
    chunks: [{ text: `${path}:${size}:${overlap}`, page: 1, bbox: { x: 0, y: 0, w: 1, h: 1 } }],
  })),
}));

const ANSWER = JSON.stringify({ claims: [{ text: 'n = 30', sources: [1] }] });

describe('AskConversationService (#53)', () => {
  let db: DatabaseAdapter;
  let model: FakeAnswerModel;
  let services: AskServices;
  let projectId: number;
  let articleId: number;

  beforeEach(() => {
    db = new DatabaseAdapter(':memory:');
    model = new FakeAnswerModel(ANSWER);
    services = buildAskServices(db, { embedder: new FakeEmbedder(), complete: model.complete, modelId: 'm' });
    projectId = db.createProject('Revisão').id;
    articleId = addIndexedArticle(projectId, 'Silva', 'a.pdf');
  });

  function addIndexedArticle(project: number, title: string, pdf: string): number {
    const row = db
      .getDB()
      .prepare('INSERT INTO articles (project_id, title, authors, local_file_path) VALUES (?, ?, ?, ?)')
      .run(project, title, 'Silva', pdf);
    const id = Number(row.lastInsertRowid);
    const chunk = { text: 'amostra de 30', page: 3, bbox: { x: 0, y: 0, w: 1, h: 1 } };
    new VectorStore(db.getDB()).indexArticleChunks(id, [chunk], [[0, 0]], 'm');
    return id;
  }

  const ask = (question: string, conversationId: number | null = null, projectIds = [projectId]) =>
    services.conversations.send({ conversationId, projectIds, question });

  it('starts a conversation named after the question and keeps both sides', async () => {
    const conversation = await ask('  Qual a amostra?  ');

    expect(conversation.title).toBe('Qual a amostra?');
    expect(conversation.projects).toEqual([{ id: projectId, name: 'Revisão' }]);
    expect(conversation.messages.map((m) => [m.role, m.content])).toEqual([
      ['user', 'Qual a amostra?'],
      ['assistant', 'n = 30'],
    ]);
    expect(conversation.messages[1].answer?.steps).toEqual([
      { kind: 'search', chunks: 1, articles: 1, projects: ['Revisão'] },
    ]);
    expect(services.conversations.read(conversation.id)).toEqual(conversation);
  });

  it('shortens a long title', async () => {
    const { title } = await ask('a'.repeat(200));

    expect(title).toHaveLength(80);
    expect(title.endsWith('…')).toBe(true);
  });

  it('keeps a marked statement as it came', async () => {
    model.answer = '{"claims":[{"text":"inventada","sources":[99]}]}';

    const { messages } = await ask('Qual a amostra?');

    expect(messages[1].answer?.claims[0]).toMatchObject({
      text: 'inventada',
      unverified: { kind: 'unknown_source', sources: ['99'] },
    });
  });

  it('continues a conversation, with the earlier exchanges going to the model', async () => {
    const { id } = await ask('Qual a amostra?');

    const conversation = await ask('e no Silva?', id);

    expect(conversation.id).toBe(id);
    expect(conversation.messages).toHaveLength(4);
    expect(model.prompts[1]).toContain('Pergunta: Qual a amostra?\nResposta: n = 30');
  });

  it('sends only the last exchanges, since each one costs tokens', async () => {
    const { id } = await ask('pergunta 1');
    for (const question of ['pergunta 2', 'pergunta 3', 'pergunta 4']) await ask(question, id);

    await ask('pergunta 5', id);

    expect(model.prompts[4]).not.toContain('Pergunta: pergunta 1\n');
    expect(model.prompts[4]).toContain('Pergunta: pergunta 2\n');
  });

  it('lets the projects change during a conversation, keeping what was read before', async () => {
    const { id } = await ask('Qual a amostra?');
    const other = db.createProject('Outro').id;
    addIndexedArticle(other, 'Souza', 'b.pdf');

    const conversation = await ask('e aqui?', id, [other]);

    expect(conversation.projects).toEqual([{ id: other, name: 'Outro' }]);
    expect(conversation.messages[1].answer?.steps[0]).toMatchObject({ projects: ['Revisão'] });
    expect(conversation.messages[3].answer?.steps[0]).toMatchObject({ projects: ['Outro'] });
  });

  it('answers over several projects', async () => {
    const other = db.createProject('Outro').id;
    addIndexedArticle(other, 'Souza', 'b.pdf');
    model.answer = '{"claims":[{"text":"x","sources":[1]}]}';

    const { messages } = await ask('Qual a amostra?', null, [projectId, other]);

    // Same page and text in both: read once, and the step still names the two projects.
    expect(messages[1].answer?.steps[0]).toMatchObject({ chunks: 1, projects: ['Outro', 'Revisão'] });
  });

  it('keeps nothing when the question fails, so it can be sent again', async () => {
    model.error = new Error('cota esgotada');

    await expect(ask('Qual a amostra?')).rejects.toThrow('cota esgotada');

    expect(db.askConversationRepo.list()).toEqual([]);
  });

  it('refuses an empty question, spending nothing', async () => {
    await expect(ask('   ')).rejects.toThrow('Escreva a pergunta');

    expect(model.prompts).toEqual([]);
  });

  it('refuses when nothing can be read, starting no conversation', async () => {
    const empty = db.createProject('Vazio').id;

    await expect(ask('Qual a amostra?', null, [empty])).rejects.toThrow('Nenhum artigo destes projetos');

    expect(db.askConversationRepo.list()).toEqual([]);
  });

  it('says so when the conversation does not exist', () => {
    expect(() => services.conversations.read(999)).toThrow('conversationId=999');
  });

  it('works out each citation when reading, as projects come and go', async () => {
    const { id } = await ask('Qual a amostra?');
    const citation = () => services.conversations.read(id).messages[1].answer?.claims[0].citations[0];
    expect(citation()).toMatchObject({ text: 'amostra de 30', access: { kind: 'open', articleId } });

    db.deleteProject(projectId);
    expect(citation()).toMatchObject({ text: 'amostra de 30', access: { kind: 'trash' } });

    db.deleteProjectPermanent(projectId);
    expect(citation()).toMatchObject({ text: 'amostra de 30', access: { kind: 'gone' } });
  });

  it('keeps the conversation after its project is deleted for good', async () => {
    const { id } = await ask('Qual a amostra?');

    db.deleteProjectPermanent(projectId);

    const conversation = services.conversations.read(id);
    expect(conversation.projects).toEqual([]);
    expect(conversation.messages).toHaveLength(2);
    expect(db.askConversationRepo.list()[0]).toMatchObject({ id, project_count: 0 });
  });
});

describe('the parts of "Perguntar aos projetos"', () => {
  it('cuts the PDF with the settings of the massive investigation', async () => {
    const db = new DatabaseAdapter(':memory:');
    db.setSetting('rag_chunk_size', '500');
    db.setSetting('rag_chunk_overlap', '50');

    expect((await pdfChunkReader(db)('a.pdf')).map((c) => c.text)).toEqual(['a.pdf:500:50']);
  });

  it('has defaults for those settings', async () => {
    const db = new DatabaseAdapter(':memory:');

    expect((await pdfChunkReader(db)('a.pdf')).map((c) => c.text)).toEqual(['a.pdf:1000:200']);
  });

  it('the E2E models answer one statement that checks out and one that does not, without leaving the machine', async () => {
    const models = e2eAskModels();

    expect(await models.embedder.embedBatch(['a', 'b'])).toHaveLength(2);
    expect(await models.embedder.embed('a')).toHaveLength(4);
    expect(JSON.parse(await models.complete('x')).claims.map((c: { sources: number[] }) => c.sources)).toEqual([
      [1],
      [999],
    ]);
  });
});

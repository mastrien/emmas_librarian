import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { VectorStore } from '../../services/VectorStore';
import { registerProjectQuestionHandlers } from '../handlers/projectQuestionHandlers';
import { IpcChannel } from '../../types';
import type { AskConversation, AskConversationSummary, ProjectIndexCoverage } from '../../../src/types/ask';
import { FakeAnswerModel, FakeEmbedder } from '../../services/projectQuestion/__tests__/fakes';
import { FakeIpcMain } from './fakes/FakeIpcMain';

vi.mock('electron', () => ({ safeStorage: {}, app: { isPackaged: false } }));

vi.mock('../../services/PdfExtractor', () => ({
  extractTextWithCoordinates: vi.fn(async () => {
    await pdfRead.wait;
    return { chunks: [{ text: 'do pdf', page: 1, bbox: { x: 0, y: 0, w: 1, h: 1 } }] };
  }),
}));

// Lets a test hold the indexing halfway.
const pdfRead = vi.hoisted(() => ({ wait: Promise.resolve() as Promise<void> }));

describe('"Perguntar aos projetos" IPC handlers (#53)', () => {
  let ipc: FakeIpcMain;
  let db: DatabaseAdapter;
  let embedder: FakeEmbedder;
  let projectId: number;
  let indexed: number;

  beforeEach(() => {
    ipc = new FakeIpcMain();
    db = new DatabaseAdapter(':memory:');
    embedder = new FakeEmbedder();
    pdfRead.wait = Promise.resolve();
    const model = new FakeAnswerModel('{"claims":[{"text":"n = 30","sources":[1]}]}');
    projectId = db.createProject('Revisão').id;
    indexed = addArticle('A', 'a.pdf');
    new VectorStore(db.getDB()).indexArticleChunks(
      indexed,
      [{ text: 't', page: 1, bbox: { x: 0, y: 0, w: 1, h: 1 } }],
      [[0, 0]],
      'm',
    );
    registerProjectQuestionHandlers(ipc, db, () => ({ embedder, complete: model.complete, modelId: 'm' }));
  });

  function addArticle(title: string, pdf: string | null): number {
    const insert = db.getDB().prepare('INSERT INTO articles (project_id, title, local_file_path) VALUES (?, ?, ?)');
    return Number(insert.run(projectId, title, pdf).lastInsertRowid);
  }

  const send = () =>
    ipc.invoke(IpcChannel.ASK_SEND, {
      conversationId: null,
      projectIds: [projectId],
      question: 'Qual a amostra?',
    }) as Promise<AskConversation>;

  it('answers, keeps and lists a conversation', async () => {
    const { id, messages } = await send();

    expect(messages[1].content).toBe('n = 30');
    expect(((await ipc.invoke(IpcChannel.ASK_CONVERSATIONS_LIST)) as AskConversationSummary[])[0].id).toBe(id);
    expect(((await ipc.invoke(IpcChannel.ASK_CONVERSATION_GET, id)) as AskConversation).messages).toHaveLength(2);
  });

  it('deletes a conversation', async () => {
    const { id } = await send();

    await ipc.invoke(IpcChannel.ASK_CONVERSATION_DELETE, id);

    expect(await ipc.invoke(IpcChannel.ASK_CONVERSATIONS_LIST)).toEqual([]);
  });

  it('reports the coverage of the projects', async () => {
    addArticle('Falta', 'b.pdf');

    const coverage = (await ipc.invoke(IpcChannel.ASK_COVERAGE, [projectId])) as ProjectIndexCoverage;

    expect(coverage.indexed.map((a) => a.id)).toEqual([indexed]);
    expect(coverage.withoutIndex.map((a) => a.title)).toEqual(['Falta']);
  });

  it('indexes what is missing', async () => {
    addArticle('Falta', 'b.pdf');

    const { coverage, failed } = (await ipc.invoke(IpcChannel.ASK_INDEX_MISSING, [projectId])) as {
      coverage: ProjectIndexCoverage;
      failed: unknown[];
    };

    expect(failed).toEqual([]);
    expect(coverage.withoutIndex).toEqual([]);
  });

  it('joins an indexing already running, so nothing is indexed twice', async () => {
    addArticle('Falta', 'b.pdf');
    let release: () => void = () => undefined;
    pdfRead.wait = new Promise<void>((resolve) => (release = resolve));

    const first = ipc.invoke(IpcChannel.ASK_INDEX_MISSING, [projectId]);
    const second = ipc.invoke(IpcChannel.ASK_INDEX_MISSING, [projectId]);
    await vi.waitFor(() => expect(embedder.calls).toHaveLength(1));
    release();
    await Promise.all([first, second]);

    expect(embedder.batches).toHaveLength(1);
    expect(db.getDB().prepare("SELECT count(*) AS n FROM pdf_chunks WHERE text_content = 'do pdf'").get()).toEqual({
      n: 1,
    });
  });

  it('can index again after the first one ended', async () => {
    addArticle('Falta', 'b.pdf');
    await ipc.invoke(IpcChannel.ASK_INDEX_MISSING, [projectId]);
    addArticle('Outra', 'c.pdf');

    await ipc.invoke(IpcChannel.ASK_INDEX_MISSING, [projectId]);

    expect(embedder.batches).toHaveLength(2);
  });
});

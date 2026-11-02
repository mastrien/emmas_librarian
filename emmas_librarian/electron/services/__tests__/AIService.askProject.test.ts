import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIService } from '../AIService';
import { VectorStore } from '../VectorStore';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { AIModelConfigRepository } from '../../database/AIModelConfigRepository';

vi.mock('electron', () => ({ safeStorage: {} }));

// The embedding provider is the one thing that leaves the machine.
vi.mock('../EmbeddingService', () => ({
  EmbeddingService: class FakeEmbeddingService {
    async embed(): Promise<number[]> {
      return [0, 0];
    }
  },
}));

describe('AIService project questions (#53)', () => {
  let db: DatabaseAdapter;
  let ai: AIService;
  let articleId: number;
  let completion: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = new DatabaseAdapter(':memory:');
    new AIModelConfigRepository(db.getDB()).updateConfig('embeddings', 'ollama', 'nomic');
    ai = new AIService(db);
    completion = vi.fn(async () => '{"claims":[{"text":"n = 30","sources":[1]}]}');
    (ai as unknown as { generateCompletion: typeof completion }).generateCompletion = completion;
    const project = db.createProject('Revisão').id;
    const insert = db.getDB().prepare("INSERT INTO articles (project_id, title) VALUES (?, 'Silva')");
    articleId = Number(insert.run(project).lastInsertRowid);
    const chunk = { text: 'n = 30', page: 3, bbox: { x: 0, y: 0, w: 1, h: 1 } };
    new VectorStore(db.getDB()).indexArticleChunks(articleId, [chunk], [[0, 0]], 'ollama/nomic');
  });

  it('answers through the extraction model, citing the page', async () => {
    const answer = await ai.askProject('Qual a amostra?', [articleId]);

    expect(completion).toHaveBeenCalledWith(expect.stringContaining('[T1] Silva, página 3'), 'extraction');
    expect(answer.claims[0].citations[0]).toMatchObject({ articleId, page: 3 });
  });

  it('compares with the embedding model configured now', () => {
    expect(ai.projectIndexCoverage([articleId]).otherModel).toEqual([]);

    new AIModelConfigRepository(db.getDB()).updateConfig('embeddings', 'openai', 'small');

    expect(ai.projectIndexCoverage([articleId]).otherModel.map((a) => a.id)).toEqual([articleId]);
  });
});

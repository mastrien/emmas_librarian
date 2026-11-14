import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseAdapter } from '../../../database/DatabaseAdapter';
import {
  examplesNeeded,
  normalized,
  originalFound,
  rankByRelevance,
  relevanceOf,
  simulateFound,
  train,
  type SimulatedArticle,
} from '../screeningRanker';
import { ScreeningOrderService, type DecidedArticle, type TextEmbedder } from '../ScreeningOrderService';

vi.mock('electron', () => ({ safeStorage: {} }));

const near = (x: number, y: number) => normalized([x, y]);
const RELEVANT_SIDE = [near(1, 0), near(0.95, 0.1), near(0.9, 0.2)];
const EXCLUDED_SIDE = [near(0, 1), near(0.1, 0.95), near(0.2, 0.9)];
const examples = [
  ...RELEVANT_SIDE.map((vector) => ({ vector, relevant: true })),
  ...EXCLUDED_SIDE.map((vector) => ({ vector, relevant: false })),
];

describe('the classifier (#55)', () => {
  it('scales a vector to length 1, and leaves an empty one alone', () => {
    expect([...normalized([3, 4])]).toEqual([0.6, 0.8]);
    expect([...normalized([0, 0])]).toEqual([0, 0]);
  });

  it('learns which side is relevant', () => {
    const weights = train(examples);

    expect(relevanceOf(weights, near(1, 0.05))).toBeGreaterThan(0.7);
    expect(relevanceOf(weights, near(0.05, 1))).toBeLessThan(0.3);
  });

  it('gives the same answer every time', () => {
    expect([...train(examples)]).toEqual([...train(examples)]);
  });

  it('does not give up on the minority: a screening has few relevant articles', () => {
    const skewed = [
      { vector: near(1, 0), relevant: true },
      ...Array.from({ length: 30 }, (_, i) => ({ vector: near(i / 100, 1), relevant: false })),
    ];

    expect(relevanceOf(train(skewed), near(1, 0))).toBeGreaterThan(0.5);
  });

  it('puts the likeliest first, and a tie keeps the order given', () => {
    const pending = [
      { id: 1, vector: near(0, 1) },
      { id: 2, vector: near(1, 0) },
      { id: 3, vector: near(1, 0) },
    ];

    expect(rankByRelevance(examples, pending)).toEqual([2, 3, 1]);
  });

  it('says how many examples are missing', () => {
    expect(examplesNeeded(2, 5)).toEqual({ needRelevant: 1, needExcluded: 0 });
    expect(examplesNeeded(3, 3)).toEqual({ needRelevant: 0, needExcluded: 0 });
  });
});

describe('the simulation (#55)', () => {
  // The relevant articles are the last ones in the original order, and on one side of the space.
  const articles: SimulatedArticle[] = [
    ...Array.from({ length: 30 }, (_, i) => ({ id: i, vector: near(0.05, 1), relevant: false })),
    ...Array.from({ length: 10 }, (_, i) => ({ id: 30 + i, vector: near(1, 0.05), relevant: true })),
  ];
  // Enough of each right at the start, so the classifier can begin.
  const walked = [...articles.slice(30, 33), ...articles.slice(0, 3), ...articles.slice(3, 30), ...articles.slice(33)];

  it('finds the relevant articles sooner than the original order', async () => {
    const predicted = await simulateFound(walked);

    expect(predicted[9]).toBeGreaterThan(originalFound(walked)[9]);
    expect(predicted[predicted.length - 1]).toBe(10);
    expect(predicted).toHaveLength(40);
  });

  it('counts the relevant articles found in the original order', () => {
    expect(originalFound(articles.slice(28, 32))).toEqual([0, 0, 1, 2]);
  });

  it('repeats its result', async () => {
    expect(await simulateFound(walked)).toEqual(await simulateFound(walked));
  });

  it('keeps the original order when it never has enough examples', async () => {
    const few = articles.slice(0, 5);

    expect(await simulateFound(few)).toEqual(originalFound(few));
  });

  it('has nothing to say about no articles', async () => {
    expect(await simulateFound([])).toEqual([]);
  });
});

/** Gives each text the vector the test chose, and keeps what it was asked. */
class FakeTextEmbedder implements TextEmbedder {
  batches: string[][] = [];
  failing = false;

  async embedBatch(texts: string[]): Promise<number[][]> {
    this.batches.push(texts);
    if (this.failing) throw new Error('provedor fora do ar');
    return texts.map((text) => (text.startsWith('Relevante') ? [1, 0] : [0, 1]));
  }
}

describe('ScreeningOrderService, on real SQLite', () => {
  const MODEL = 'ollama/atual';
  let adapter: DatabaseAdapter;
  let embedder: FakeTextEmbedder;
  let decided: DecidedArticle[];
  let projectId: number;

  beforeEach(() => {
    adapter = new DatabaseAdapter(':memory:');
    embedder = new FakeTextEmbedder();
    decided = [];
    projectId = adapter.createProject('Revisão').id;
  });

  const add = (title: string, extra: { abstract?: string; status?: string } = {}) =>
    Number(
      adapter
        .getDB()
        .prepare('INSERT INTO articles (project_id, title, abstract, status) VALUES (?, ?, ?, ?)')
        .run(projectId, title, extra.abstract ?? null, extra.status ?? 'new').lastInsertRowid,
    );

  const service = (model = MODEL) =>
    new ScreeningOrderService(adapter.articleVectorRepo, { decided: () => decided }, embedder, model);

  const generateAll = async (model = MODEL) => {
    while ((await service(model).generateNext(projectId)).pending > 0);
  };

  it('plans without asking the provider anything', () => {
    add('A');
    add('B');

    expect(service().plan(projectId)).toEqual({ total: 2, pending: 2, provider: 'ollama', previousModel: null });
    expect(embedder.batches).toEqual([]);
  });

  it('generates a batch at a time, from title and abstract, and says how many are left', async () => {
    add('Com resumo', { abstract: 'o resumo' });
    for (let i = 0; i < 20; i++) add(`Artigo ${i}`);

    const step = await service().generateNext(projectId);

    expect(step).toEqual({ generated: 16, pending: 5 });
    expect(embedder.batches[0][0]).toBe('Com resumo\no resumo');
  });

  it('skips what already has a vector, until the title or the abstract changes', async () => {
    const id = add('A', { abstract: 'antes' });
    await generateAll();
    expect(service().plan(projectId).pending).toBe(0);

    adapter.getDB().prepare("UPDATE articles SET abstract = 'depois' WHERE id = ?").run(id);

    expect(service().plan(projectId).pending).toBe(1);
  });

  it('leaves out an archived article with no decision, which the screening does not walk', () => {
    add('Arquivado', { status: 'archived' });

    expect(service().plan(projectId).total).toBe(0);
  });

  it('keeps what was saved when the provider fails, leaving the rest pending', async () => {
    for (let i = 0; i < 20; i++) add(`Artigo ${i}`);
    await service().generateNext(projectId);
    embedder.failing = true;

    await expect(service().generateNext(projectId)).rejects.toThrow('provedor fora do ar');

    expect(service().plan(projectId).pending).toBe(4);
  });

  it('keeps vectors per model: another one starts over, and names the previous', async () => {
    add('A');
    await generateAll('ollama/velho');

    expect(service('gemini/novo').plan(projectId)).toMatchObject({ pending: 1, previousModel: 'ollama/velho' });
    expect(service('ollama/velho').plan(projectId)).toMatchObject({ pending: 0, previousModel: null });
  });

  it('reads a vector back as it was saved', async () => {
    const id = add('Relevante');
    await generateAll();

    expect([...(adapter.articleVectorRepo.vectors(projectId, MODEL).get(id) as Float32Array)]).toEqual([1, 0]);
  });

  describe('ranking', () => {
    const seed = () => {
      const relevant = [add('Relevante 1'), add('Relevante 2'), add('Relevante 3')];
      const excluded = [add('Fora 1'), add('Fora 2'), add('Fora 3')];
      decided = [
        { articleId: relevant[0], kind: 'include' },
        { articleId: relevant[1], kind: 'include' },
        // "Em dúvida" advances to the full text, so it teaches the same as "incluir".
        { articleId: relevant[2], kind: 'maybe' },
        ...excluded.map((articleId) => ({ articleId, kind: 'exclude' as const })),
      ];
    };

    it('puts the likeliest pending article first, and never a decided one', async () => {
      seed();
      const unlikely = add('Fora 4');
      const likely = add('Relevante 4');
      await generateAll();

      expect(service().rank(projectId)).toEqual({
        order: [likely, unlikely],
        learnedFrom: 6,
        needRelevant: 0,
        needExcluded: 0,
      });
    });

    it('waits for enough examples, saying how many are missing', async () => {
      const relevant = add('Relevante 1');
      add('Relevante 2');
      await generateAll();
      decided = [{ articleId: relevant, kind: 'include' }];

      expect(service().rank(projectId)).toEqual({ order: [], learnedFrom: 1, needRelevant: 2, needExcluded: 3 });
    });

    it('does not learn from duplicates, nor offer them', async () => {
      seed();
      const duplicate = add('Relevante 5');
      await generateAll();
      decided.push({ articleId: duplicate, kind: 'removed' });

      const rank = service().rank(projectId);

      expect(rank.learnedFrom).toBe(6);
      expect(rank.order).toEqual([]);
    });

    it('uses only the vectors of the current model', async () => {
      seed();
      await generateAll('ollama/velho');

      expect(service().rank(projectId)).toMatchObject({ order: [], learnedFrom: 0, needRelevant: 3 });
    });

    it('changes no decision', async () => {
      seed();
      await generateAll();

      service().rank(projectId);

      expect(adapter.screeningDecisionRepo.listDecisions(projectId)).toEqual([]);
    });

    it('simulates over what was decided, counting what has no vector', async () => {
      seed();
      await generateAll();
      const without = add('Sem vetor');
      decided.push({ articleId: without, kind: 'include' });

      const simulation = await service().simulate(projectId);

      expect(simulation).toMatchObject({ articles: 6, relevant: 3, withoutVector: 1 });
      expect(simulation.predicted).toHaveLength(6);
      expect(simulation.original).toHaveLength(6);
    });
  });

  it('remembers per project whether the order is on, off by default', () => {
    const other = adapter.createProject('Outro').id;

    expect(adapter.articleVectorRepo.isOrderOn(projectId)).toBe(false);
    adapter.articleVectorRepo.setOrderOn(projectId, true);

    expect(adapter.articleVectorRepo.isOrderOn(projectId)).toBe(true);
    expect(adapter.articleVectorRepo.isOrderOn(other)).toBe(false);
  });

  it('removes the vectors with the article', async () => {
    const id = add('A');
    await generateAll();

    adapter.getDB().prepare('DELETE FROM articles WHERE id = ?').run(id);

    expect(adapter.getDB().prepare('SELECT count(*) AS n FROM article_vectors').get()).toEqual({ n: 0 });
  });
});

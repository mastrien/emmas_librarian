import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseAdapter } from '../../../database/DatabaseAdapter';
import { ClassifierEvaluationService, heldOutRelevance, kindForRelevance } from '../ClassifierEvaluationService';
import type { DecidedArticle } from '../ScreeningOrderService';
import { normalized, type SimulatedArticle } from '../screeningRanker';
import { criteriaSnapshot } from '../../../../src/utils/screeningCriteria';

const side = (id: number, relevant: boolean): SimulatedArticle => ({
  id,
  relevant,
  vector: normalized(relevant ? [1, 0.02 * id] : [0.02 * id, 1]),
});
const twoSides = Array.from({ length: 20 }, (_, i) => side(i, i % 2 === 0));

describe('heldOutRelevance', () => {
  it('gives each article one verdict', () => {
    expect(
      heldOutRelevance(twoSides)
        .map((v) => v.articleId)
        .sort((a, b) => a - b),
    ).toEqual(twoSides.map((a) => a.id));
  });

  it('gets separable articles right, on rounds that did not learn from them', () => {
    for (const { articleId, relevance } of heldOutRelevance(twoSides)) {
      if (articleId % 2 === 0) expect(relevance).toBeGreaterThan(0.5);
      else expect(relevance).toBeLessThan(0.5);
    }
  });

  // An article that goes against its neighbours exposes a test on what was learned: trained on itself, it would score high.
  it('does not learn from the article it judges', () => {
    const outlier = { id: 100, relevant: true, vector: normalized([0.02, 1]) };

    const verdict = heldOutRelevance([...twoSides, outlier]).find((v) => v.articleId === 100);

    expect(verdict?.relevance).toBeLessThan(0.5);
  });

  it('gives no verdict with too few examples', () => {
    expect(heldOutRelevance(twoSides.slice(0, 4))).toEqual([]);
  });

  it('repeats its result', () => {
    expect(heldOutRelevance(twoSides)).toEqual(heldOutRelevance(twoSides));
  });
});

describe('kindForRelevance', () => {
  it.each([
    [0.9, 'include'],
    [0.6, 'include'],
    [0.5, 'maybe'],
    [0.4, 'maybe'],
    [0.39, 'exclude'],
  ])('reads %f as %s', (relevance, kind) => {
    expect(kindForRelevance(relevance)).toBe(kind);
  });
});

describe('ClassifierEvaluationService, on real SQLite', () => {
  const MODEL = 'ollama/x';
  let adapter: DatabaseAdapter;
  let projectId: number;
  let decided: DecidedArticle[];

  beforeEach(() => {
    adapter = new DatabaseAdapter(':memory:');
    projectId = adapter.createProject('Revisão').id;
    decided = [];
  });

  const addDecided = (relevant: boolean, position: number) => {
    const insert = adapter.getDB().prepare("INSERT INTO articles (project_id, title) VALUES (?, 'A')");
    const id = Number(insert.run(projectId).lastInsertRowid);
    adapter.articleVectorRepo.save(id, MODEL, relevant ? [1, 0.02 * position] : [0.02 * position, 1], 'h');
    decided.push({ articleId: id, kind: relevant ? 'include' : 'exclude' });
    return id;
  };

  const seed = () => Array.from({ length: 20 }, (_, i) => addDecided(i % 2 === 0, i));

  const service = (labels = adapter.screeningLabelRepo.listLabels(projectId).filter((l) => l.kind !== 'removed')) =>
    new ClassifierEvaluationService(
      adapter.articleVectorRepo,
      adapter.screeningSuggestionRepo,
      { decided: () => decided, labels: () => labels, criteria: () => ({ inclusion: 'adultos', exclusion: '' }) },
      MODEL,
    );

  it('keeps a verdict per article under an engine of its own, with the current criteria, spending no tokens', () => {
    seed();

    const saved = service().evaluate(projectId);

    expect(saved).toHaveLength(20);
    expect(saved[0]).toMatchObject({
      engine: 'classificador-local/ollama/x',
      criteria: criteriaSnapshot({ inclusion: 'adultos', exclusion: '' }),
      quote: null,
      tokens_estimated: 0,
    });
    expect(adapter.screeningSuggestionRepo.listForProject(projectId)).toHaveLength(20);
  });

  it('marks a label of the kind the relevance stands for', () => {
    const ids = seed();
    const labels = adapter.screeningLabelRepo.listLabels(projectId);
    const kindOf = (id: number) => labels.find((label) => label.id === id)?.kind;

    const saved = service().evaluate(projectId);

    expect(kindOf(saved.find((s) => s.article_id === ids[0])?.label_id ?? 0)).toBe('include');
    expect(kindOf(saved.find((s) => s.article_id === ids[1])?.label_id ?? 0)).toBe('exclude');
  });

  it('falls on the side it leans to when the project has no "em dúvida" label', () => {
    seed();
    const labels = adapter.screeningLabelRepo
      .listLabels(projectId)
      .filter((l) => l.kind === 'include' || l.kind === 'exclude');

    const saved = service(labels).evaluate(projectId);

    expect(saved.every((s) => labels.some((label) => label.id === s.label_id))).toBe(true);
  });

  it('runs again in place, and changes no decision', () => {
    seed();
    service().evaluate(projectId);

    service().evaluate(projectId);

    expect(adapter.screeningSuggestionRepo.listForProject(projectId)).toHaveLength(20);
    expect(adapter.screeningDecisionRepo.listDecisions(projectId)).toEqual([]);
  });

  it('leaves out duplicates and articles without a vector', () => {
    const ids = seed();
    decided[0] = { articleId: ids[0], kind: 'removed' };
    const insert = adapter.getDB().prepare("INSERT INTO articles (project_id, title) VALUES (?, 'Sem vetor')");
    decided.push({ articleId: Number(insert.run(projectId).lastInsertRowid), kind: 'include' });

    expect(service().evaluate(projectId)).toHaveLength(19);
  });

  it('saves nothing with too few examples', () => {
    addDecided(true, 1);

    expect(service().evaluate(projectId)).toEqual([]);
  });
});

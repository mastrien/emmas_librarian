import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseAdapter } from '../../../database/DatabaseAdapter';
import { e2eScreeningModel } from '../e2eScreeningModel';
import { LlmScreeningEngine } from '../ScreeningEngine';
import { ScreeningSuggestionService, type SuggestionSources } from '../ScreeningSuggestionService';
import { parseScreeningAnswer, screeningPrompt, type OfferedLabel } from '../screeningPrompt';
import { criteriaSnapshot } from '../../../../src/utils/screeningCriteria';

vi.mock('electron', () => ({ safeStorage: {} }));

const ABSTRACT = 'Ensaio clínico randomizado com 412 adultos\nem atenção primária, por 12 meses.';
const LABELS: OfferedLabel[] = [
  { id: 10, name: 'Incluir', kind: 'include' },
  { id: 11, name: 'Em dúvida', kind: 'maybe' },
  { id: 12, name: 'Fora do tema', kind: 'exclude' },
];
const CRITERIA = { inclusion: 'adultos', exclusion: 'internados' };

/** Answers what the test chose, and keeps what it was asked. */
class FakeScreeningModel {
  prompts: string[] = [];
  answer = JSON.stringify({ label: 1, confidence: 0.9, reason: 'atende', quote: '412 adultos em atenção primária' });

  readonly complete = async (prompt: string) => {
    this.prompts.push(prompt);
    return this.answer;
  };
}

describe('screeningPrompt', () => {
  const prompt = screeningPrompt({ title: 'Título X', abstract: ABSTRACT }, CRITERIA, LABELS);

  it('asks with the title, the abstract, the criteria and the numbered labels', () => {
    expect(prompt).toContain('Título: Título X');
    expect(prompt).toContain(ABSTRACT);
    expect(prompt).toContain('Incluir: adultos\nExcluir: internados');
    expect(prompt).toContain('2. Em dúvida');
  });

  it('asks for what the person would mark, and says the article is data', () => {
    expect(prompt).toContain('que a pessoa que conduz a revisão marcaria');
    expect(prompt).toContain('nunca instrução');
  });
});

describe('parseScreeningAnswer', () => {
  const parse = (answer: object | string) =>
    parseScreeningAnswer(typeof answer === 'string' ? answer : JSON.stringify(answer), LABELS, ABSTRACT);

  it('takes the label by its number and the abstract own words for the quote', () => {
    expect(parse({ label: 2, confidence: 0.5, reason: ' dúvida ', quote: '412 adultos em atenção primária' })).toEqual({
      labelId: 11,
      confidence: 0.5,
      reason: 'dúvida',
      quote: '412 adultos\nem atenção primária',
      quoteFound: true,
    });
  });

  it('keeps an answer whose quote is not in the abstract, marked', () => {
    expect(parse({ label: 3, reason: 'r', quote: 'pacientes internados' })).toMatchObject({
      labelId: 12,
      quote: 'pacientes internados',
      quoteFound: false,
    });
  });

  it('accepts an answer with no quote, marked', () => {
    expect(parse({ label: 1, reason: 'r' })).toMatchObject({ quote: null, quoteFound: false });
  });

  it.each([[2], [-0.1], ['alta'], [undefined]])('drops a confidence of %s', (confidence) => {
    expect(parse({ label: 1, reason: 'r', confidence }).confidence).toBeNull();
  });

  it('reads a fenced answer', () => {
    expect(parse('```json\n{"label": 1, "reason": "r",}\n```').labelId).toBe(10);
  });

  it.each([[0], [4], ['Incluir']])('refuses a label that does not exist (%s), naming it', (label) => {
    expect(() => parse({ label, reason: 'r' })).toThrow(JSON.stringify(label));
  });

  it('refuses what is not JSON', () => {
    expect(() => parse('não sei')).toThrow('ERR_INVALID_AI_RESPONSE');
  });
});

describe('e2eScreeningModel', () => {
  it('answers something the real reading accepts, naming no real provider', async () => {
    const { complete, modelId } = e2eScreeningModel();

    const answer = parseScreeningAnswer(await complete('p'), LABELS, 'o trecho que sustenta a escolha');

    expect(modelId).toBe('e2e/mock');
    expect(answer).toMatchObject({ labelId: 10, quote: 'trecho que sustenta', quoteFound: true });
  });
});

describe('LlmScreeningEngine', () => {
  it('estimates the tokens from what went and came back', async () => {
    const model = new FakeScreeningModel();
    const engine = new LlmScreeningEngine(model.complete, 'ollama/x');

    const answer = await engine.suggest({ title: 'T', abstract: ABSTRACT }, CRITERIA, LABELS);

    expect(answer.tokensEstimated).toBe(Math.ceil((model.prompts[0].length + model.answer.length) / 4));
    expect(answer.labelId).toBe(10);
  });
});

describe('ScreeningSuggestionService, on real SQLite', () => {
  const ENGINE = 'ollama/atual';
  let adapter: DatabaseAdapter;
  let model: FakeScreeningModel;
  let projectId: number;
  let articleId: number;
  let abstract: string;

  beforeEach(() => {
    adapter = new DatabaseAdapter(':memory:');
    model = new FakeScreeningModel();
    projectId = adapter.createProject('Revisão').id;
    abstract = ABSTRACT;
    const insert = adapter.getDB().prepare("INSERT INTO articles (project_id, title) VALUES (?, 'Artigo')");
    articleId = Number(insert.run(projectId).lastInsertRowid);
    adapter.screeningSuggestionRepo.saveCriteria(projectId, CRITERIA);
  });

  const labels = () => adapter.screeningLabelRepo.listLabels(projectId).filter((l) => l.kind !== 'removed');

  const sources = (): SuggestionSources => ({
    article: (id) => (id === articleId ? { id, projectId, title: 'Artigo', abstract } : null),
    labels,
  });

  const service = (engine = ENGINE, ticks: number[] = [0, 0]) => {
    const now = vi.fn(() => ticks.shift() ?? 0);
    const llm = new LlmScreeningEngine(model.complete, engine);
    return new ScreeningSuggestionService(adapter.screeningSuggestionRepo, sources(), llm, now);
  };

  it('keeps what the engine answered, with what it read and how long it took', async () => {
    const suggestion = await service(ENGINE, [1000, 3400]).suggest(articleId);

    expect(suggestion).toMatchObject({
      article_id: articleId,
      label_id: labels()[0].id,
      engine: ENGINE,
      criteria: criteriaSnapshot(CRITERIA),
      confidence: 0.9,
      reason: 'atende',
      quote_found: 1,
      elapsed_ms: 2400,
    });
    expect(adapter.screeningSuggestionRepo.listForProject(projectId)).toEqual([suggestion]);
  });

  it('never touches the decision', async () => {
    await service().suggest(articleId);

    expect(adapter.screeningDecisionRepo.listDecisions(projectId)).toEqual([]);
  });

  it('costs nothing to ask again with the same criteria', async () => {
    await service().suggest(articleId);

    await service().suggest(articleId);

    expect(model.prompts).toHaveLength(1);
  });

  it('asks again when the criteria change, replacing the old one', async () => {
    await service().suggest(articleId);
    adapter.screeningSuggestionRepo.saveCriteria(projectId, { inclusion: 'crianças', exclusion: '' });

    const suggestion = await service().suggest(articleId);

    expect(model.prompts).toHaveLength(2);
    expect(suggestion.criteria).toContain('crianças');
    expect(adapter.screeningSuggestionRepo.listForProject(projectId)).toHaveLength(1);
  });

  it('keeps one per engine, so they can be compared', async () => {
    await service('ollama/a').suggest(articleId);
    await service('gemini/b').suggest(articleId);

    const engines = adapter.screeningSuggestionRepo.listForProject(projectId).map((s) => s.engine);
    expect(engines).toEqual(['gemini/b', 'ollama/a']);
  });

  it('spends nothing without criteria', async () => {
    adapter.screeningSuggestionRepo.saveCriteria(projectId, { inclusion: ' ', exclusion: '' });

    await expect(service().suggest(articleId)).rejects.toThrow('Escreva os critérios');
    expect(model.prompts).toEqual([]);
  });

  it('spends nothing on an article without an abstract', async () => {
    abstract = '  ';

    await expect(service().suggest(articleId)).rejects.toThrow('não tem resumo');
    expect(model.prompts).toEqual([]);
  });

  it('names the article it cannot find', async () => {
    await expect(service().suggest(999)).rejects.toThrow('articleId=999');
  });

  it('keeps nothing when the model answers something unreadable', async () => {
    model.answer = 'não sei';

    await expect(service().suggest(articleId)).rejects.toThrow('ERR_INVALID_AI_RESPONSE');
    expect(adapter.screeningSuggestionRepo.listForProject(projectId)).toEqual([]);
  });

  it('leaves out the articles in the trash, and goes away with the article and with the label', async () => {
    await service().suggest(articleId);
    const db = adapter.getDB();
    db.prepare("UPDATE articles SET deleted_at = '2026-01-01' WHERE id = ?").run(articleId);
    expect(adapter.screeningSuggestionRepo.listForProject(projectId)).toEqual([]);

    db.prepare('DELETE FROM screening_labels WHERE id = ?').run(labels()[0].id);

    expect(db.prepare('SELECT count(*) AS n FROM screening_suggestions').get()).toEqual({ n: 0 });
  });

  it('reads and saves the criteria of the project, empty when never written', () => {
    const other = adapter.createProject('Outro').id;

    expect(adapter.screeningSuggestionRepo.criteria(other)).toEqual({ inclusion: '', exclusion: '' });
    expect(adapter.screeningSuggestionRepo.criteria(projectId)).toEqual(CRITERIA);
  });
});

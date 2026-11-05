import { describe, expect, it } from 'vitest';
import type { ScreeningDecision, ScreeningKind, ScreeningLabel, ScreeningSuggestion } from '../../types';
import { criteriaSnapshot, hasCriteria, providerName } from '../screeningCriteria';
import { evaluateEngines, rateText, sampleArticles } from '../screeningEvaluation';

const CRITERIA = 'Incluir: adultos\nExcluir: ';
const label = (id: number, kind: ScreeningKind, name: string = kind): ScreeningLabel =>
  ({ id, kind, name, project_id: 1, position: id }) as ScreeningLabel;
const LABELS = [label(1, 'include'), label(2, 'maybe'), label(3, 'exclude', 'fora'), label(4, 'removed')];
const [INCLUDE, MAYBE, EXCLUDE, REMOVED] = [1, 2, 3, 4];

const decision = (articleId: number, labelId: number, stage: 'title' | 'full' = 'title') =>
  ({ article_id: articleId, label_id: labelId, stage }) as ScreeningDecision;

const suggestion = (articleId: number, labelId: number, extra: Partial<ScreeningSuggestion> = {}) =>
  ({
    id: articleId,
    article_id: articleId,
    label_id: labelId,
    engine: 'a',
    criteria: CRITERIA,
    confidence: null,
    elapsed_ms: 1000,
    tokens_estimated: 100,
    ...extra,
  }) as ScreeningSuggestion;

const evaluate = (decisions: ScreeningDecision[], suggestions: ScreeningSuggestion[]) =>
  evaluateEngines({ decisions, labels: LABELS, suggestions, criteria: CRITERIA });

describe('evaluateEngines (#54)', () => {
  // 3 kept by the person (2 include, 1 maybe); the engine loses one, and keeps one the person excluded.
  const decisions = [
    decision(1, INCLUDE),
    decision(2, INCLUDE),
    decision(3, MAYBE),
    decision(4, EXCLUDE),
    decision(5, EXCLUDE),
  ];
  const suggestions = [
    suggestion(1, INCLUDE),
    suggestion(2, MAYBE),
    suggestion(3, EXCLUDE),
    suggestion(4, INCLUDE),
    suggestion(5, EXCLUDE),
  ];

  it('counts "em dúvida" as relevant in recall and precision', () => {
    const [result] = evaluate(decisions, suggestions);

    expect(result.recall).toEqual({ hits: 2, total: 3 });
    expect(result.precision).toEqual({ hits: 2, total: 3 });
  });

  it('counts as a hit only the kind the person marked: its goal is to get that right', () => {
    const [result] = evaluate(decisions, suggestions);

    // Article 2: include for the person, maybe for the engine. Nothing lost, but not what the person marked.
    expect(result.agreement).toEqual({ hits: 2, total: 5 });
  });

  it('names the relevant articles the engine would exclude', () => {
    expect(evaluate(decisions, suggestions)[0].missed).toEqual([
      { articleId: 3, personLabel: 'maybe', engineLabel: 'fora' },
    ]);
  });

  it('sums the tokens and averages the time', () => {
    const [result] = evaluate(
      [decision(1, INCLUDE), decision(2, INCLUDE)],
      [
        suggestion(1, INCLUDE, { elapsed_ms: 1000, tokens_estimated: 10 }),
        suggestion(2, INCLUDE, { elapsed_ms: 3000, tokens_estimated: 30 }),
      ],
    );

    expect(result).toMatchObject({ meanElapsedMs: 2000, tokensEstimated: 40, articles: 2 });
  });

  it('compares engines side by side', () => {
    const results = evaluate(
      [decision(1, INCLUDE)],
      [suggestion(1, INCLUDE, { engine: 'a' }), suggestion(1, EXCLUDE, { engine: 'b', id: 9 })],
    );

    expect(results.map((r) => [r.engine, r.recall.hits])).toEqual([
      ['a', 1],
      ['b', 0],
    ]);
  });

  it('splits how often it was right by the confidence it declared', () => {
    const [result] = evaluate(
      [decision(1, INCLUDE), decision(2, INCLUDE), decision(3, EXCLUDE), decision(4, INCLUDE)],
      [
        suggestion(1, INCLUDE, { confidence: 1 }),
        suggestion(2, EXCLUDE, { confidence: 0.8 }),
        suggestion(3, EXCLUDE, { confidence: 0.5 }),
        suggestion(4, INCLUDE, { confidence: 0.49 }),
      ],
    );

    expect(result.calibration).toEqual([
      { name: '80 a 100%', articles: 2, agreed: 1 },
      { name: '50 a 79%', articles: 1, agreed: 1 },
      { name: 'Abaixo de 50%', articles: 1, agreed: 1 },
    ]);
  });

  it('leaves out what is not comparable', () => {
    const results = evaluate(
      [decision(1, INCLUDE, 'full'), decision(2, REMOVED), decision(3, INCLUDE)],
      [
        suggestion(1, INCLUDE),
        suggestion(2, INCLUDE),
        suggestion(3, INCLUDE, { criteria: 'outros critérios' }),
        suggestion(4, INCLUDE),
      ],
    );

    expect(results).toEqual([]);
  });
});

describe('rateText', () => {
  it.each([
    [{ hits: 37, total: 40 }, '92,5% (37 de 40)'],
    [{ hits: 2, total: 2 }, '100% (2 de 2)'],
    [{ hits: 0, total: 0 }, 'sem dados'],
  ])('shows %o as %s', (rate, shown) => {
    expect(rateText(rate)).toBe(shown);
  });
});

describe('sampleArticles', () => {
  const ids = Array.from({ length: 100 }, (_, i) => i + 1);

  it('keeps the same articles from one run to the next, so what was paid for is not paid again', () => {
    const shuffled = [...ids].reverse();

    expect(sampleArticles(shuffled, 10, 7)).toEqual(sampleArticles(ids, 10, 7));
  });

  it('takes the size asked, with no repeats, differing by project', () => {
    const sample = sampleArticles(ids, 10, 7);

    expect(new Set(sample).size).toBe(10);
    expect(sampleArticles(ids, 10, 8)).not.toEqual(sample);
  });

  it('takes everything when there is less than the size', () => {
    expect(sampleArticles([1, 2], 10, 7).sort()).toEqual([1, 2]);
  });
});

describe('screening criteria helpers', () => {
  it('reads the criteria as the engine does', () => {
    expect(criteriaSnapshot({ inclusion: ' adultos ', exclusion: '' })).toBe('Incluir: adultos\nExcluir: ');
  });

  it.each([
    [{ inclusion: 'a', exclusion: '' }, true],
    [{ inclusion: '', exclusion: 'b' }, true],
    [{ inclusion: ' ', exclusion: '\n' }, false],
  ])('tells whether %o has anything to compare with', (criteria, expected) => {
    expect(hasCriteria(criteria)).toBe(expected);
  });

  it('names the provider, or repeats one it does not know', () => {
    expect(providerName('gemini')).toBe('Google Gemini');
    expect(providerName('novo')).toBe('novo');
  });
});

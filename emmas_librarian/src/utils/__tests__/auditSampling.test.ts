import { describe, it, expect } from 'vitest';
import {
  auditStats,
  drawSize,
  drawStratifiedSample,
  newAuditSeed,
  seededRandom,
  wilsonInterval,
  type AuditParams,
} from '../auditSampling';
import type { InvestigationResult, ReviewStatus } from '../../types';

let nextId = 1;
function result(question: string, overrides: Partial<InvestigationResult> = {}): InvestigationResult {
  return {
    id: nextId++,
    investigation_id: 1,
    article_id: nextId,
    question,
    answer: 'R',
    quote: null,
    status: 'success',
    error_message: null,
    created_at: '',
    review_status: 'pending',
    reviewed_answer: null,
    reviewed_at: null,
    ...overrides,
  };
}
const many = (question: string, n: number, overrides: Partial<InvestigationResult> = {}) =>
  Array.from({ length: n }, () => result(question, overrides));
const params: AuditParams = { seed: 48213, samplePercent: 10, minPerQuestion: 2 };

describe('stratified audit sample (#48)', () => {
  const results = [
    ...many('Desenho?', 40),
    ...many('Base?', 1),
    ...many('Região?', 25),
    ...many('Erros?', 6, { status: 'error' }),
  ];

  it('draws the same items for the same seed, and others for another seed', () => {
    const again = drawStratifiedSample([...results].reverse(), params);

    expect(drawStratifiedSample(results, params)).toEqual(again);
    expect(drawStratifiedSample(results, { ...params, seed: 7 })).not.toEqual(again);
  });

  it('gives every question with an answer at least one item, and draws nothing from errors', () => {
    const sample = drawStratifiedSample(results, { ...params, samplePercent: 1, minPerQuestion: 1 });
    const questions = results.filter((r) => sample.has(r.id)).map((r) => r.question);

    expect(new Set(questions)).toEqual(new Set(['Desenho?', 'Base?', 'Região?']));
  });

  it('takes the requested share per question, at least the minimum, never more than exists', () => {
    const sample = drawStratifiedSample(results, params);
    const count = (q: string) => results.filter((r) => r.question === q && sample.has(r.id)).length;

    expect([count('Desenho?'), count('Base?'), count('Região?')]).toEqual([4, 1, 3]);
  });

  it('keeps a question’s draw when another question is added', () => {
    const pick = (rs: InvestigationResult[]) =>
      rs.filter((r) => r.question === 'Desenho?' && drawStratifiedSample(rs, params).has(r.id)).map((r) => r.id);

    expect(pick([...results, ...many('Zzz nova?', 9)])).toEqual(pick(results));
  });

  it('sizes the draw from the share and the minimum', () => {
    expect(drawSize(40, params)).toBe(4);
    expect(drawSize(5, params)).toBe(2);
    expect(drawSize(1, params)).toBe(1);
    expect(drawSize(0, params)).toBe(0);
  });

  it('repeats a sequence from a seed and makes positive seeds', () => {
    const a = seededRandom(5);
    const b = seededRandom(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(newAuditSeed(() => 0)).toBe(1);
    expect(newAuditSeed(() => 0.999999999)).toBeLessThanOrEqual(2147483646);
  });
});

describe('Wilson interval at 95%', () => {
  it.each([
    [0, 10, 0, 0, 0.2775],
    [10, 10, 1, 0.7225, 1],
    [2, 2, 1, 0.3424, 1],
    [8, 10, 0.8, 0.4902, 0.9433],
  ])('%i of %i: estimate %f, from %f to %f', (k, n, estimate, low, high) => {
    const interval = wilsonInterval(k, n)!;

    expect(interval.estimate).toBeCloseTo(estimate, 4);
    expect(interval.low).toBeCloseTo(low, 3);
    expect(interval.high).toBeCloseTo(high, 3);
  });

  it('has no interval when nothing was marked', () => {
    expect(wilsonInterval(0, 0)).toBeNull();
  });
});

describe('audit accuracy', () => {
  it('counts accepted as correct, edited and rejected as wrong, and leaves pending out', () => {
    const marks: ReviewStatus[] = ['accepted', 'accepted', 'edited', 'rejected', 'pending'];

    const stats = auditStats(marks.map((review_status) => result('Q', { review_status })));

    expect(stats).toMatchObject({ sampled: 5, marked: 4, correct: 2 });
    expect(stats.interval?.estimate).toBe(0.5);
  });
});

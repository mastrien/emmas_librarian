import { describe, expect, it } from 'vitest';
import type { Article } from '../../../types';
import type { InvestigationRunState } from '../useInvestigationRun';
import { indexStage, startedAtText } from '../RunningView';

const run = (targets: number, results: number): Pick<InvestigationRunState, 'targets' | 'results'> => ({
  targets: Array.from({ length: targets }, (_, i) => ({ id: i + 1 }) as Article),
  results: Array.from({ length: results }, () => ({}) as InvestigationRunState['results'][number]),
});

describe('indexStage', () => {
  it('is running while an article has not been asked about yet, with how many are done', () => {
    expect(indexStage(run(9, 3))).toEqual({ state: 'run', note: '3 de 9' });
  });

  it('is done only when every article has its results', () => {
    expect(indexStage(run(9, 9))).toEqual({ state: 'done', note: '9 de 9' });
  });
});

describe('startedAtText', () => {
  it('names the time the run began', () => {
    expect(startedAtText(new Date(2026, 10, 8, 22, 5).getTime())).toBe('Iniciada às 22:05');
  });
});

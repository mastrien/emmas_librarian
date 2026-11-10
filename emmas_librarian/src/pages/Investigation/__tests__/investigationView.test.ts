import { describe, expect, it } from 'vitest';
import type { Article, InvestigationResult } from '../../../types';
import {
  callErrorGroups,
  callMatrix,
  evidencesOf,
  gridOrder,
  investigationPath,
  liveCalls,
  matchesFilter,
  nextPending,
  questionsOf,
  savedCalls,
  type CallCell,
} from '../investigationView';
import type { InvestigationRunState } from '../useInvestigationRun';

const row = (id: number, articleId: number, question: string, extra: Partial<InvestigationResult> = {}) =>
  ({
    id,
    article_id: articleId,
    question,
    status: 'success',
    review_status: 'pending',
    error_message: null,
    ...extra,
  }) as InvestigationResult;
const article = (id: number) => ({ id, title: `A${id}` }) as Article;

describe('questionsOf', () => {
  it('keeps the stored order and adds a question only the answers know', () => {
    const investigation = { id: 1, created_at: '', questions: JSON.stringify(['Q1', 'Q2']) };

    expect(questionsOf(investigation, [row(1, 1, 'Q2'), row(2, 1, 'Q9')])).toEqual(['Q1', 'Q2', 'Q9']);
  });
});

describe('savedCalls', () => {
  it('names a deleted article by its id', () => {
    expect(savedCalls([row(1, 7, 'Q1')], [])[0]).toMatchObject({ articleTitle: 'Artigo #7', status: 'success' });
  });
});

describe('liveCalls', () => {
  const run = (extra: Partial<InvestigationRunState>): InvestigationRunState => ({
    projectId: 1,
    questions: ['Q1', 'Q2'],
    targets: [article(1), article(2), article(3)],
    results: [],
    current: 2,
    isRunning: true,
    quotaHit: false,
    startedAt: 0,
    savedId: null,
    ...extra,
  });
  const statuses = (state: InvestigationRunState) => liveCalls(state).map((c) => c.status);

  it('says what finished, failed, runs and waits; the questions of an article change together', () => {
    const state = run({ results: [{ article: article(1), error: 'falhou' }] });

    expect(statuses(state)).toEqual(['error', 'error', 'running', 'running', 'queued', 'queued']);
    expect(liveCalls(state)[0].error).toBe('falhou');
  });

  it('calls what never ran skipped once the run stopped', () => {
    const state = run({ isRunning: false, current: 1, results: [{ article: article(1), result: [] }] });

    expect(statuses(state)).toEqual(['success', 'success', 'skipped', 'skipped', 'skipped', 'skipped']);
  });
});

describe('callErrorGroups', () => {
  const cell = (articleId: number, status: CallCell['status'], error: string | null): CallCell => ({
    articleId,
    articleTitle: `A${articleId}`,
    question: 'Q',
    status,
    error,
    answer: null,
    evidences: [],
  });

  it('gives one group per message, counting calls and each article once', () => {
    const groups = callErrorGroups([
      cell(1, 'error', 'x'),
      cell(1, 'error', 'x'),
      cell(2, 'error', 'x'),
      cell(3, 'skipped', 'y'),
      cell(4, 'success', null),
      cell(5, 'running', null),
    ]);

    expect(groups).toEqual([
      { message: 'x', status: 'error', count: 3, articleIds: [1, 2] },
      { message: 'y', status: 'skipped', count: 1, articleIds: [3] },
    ]);
  });

  it('has words for a failure stored without a message', () => {
    expect(callErrorGroups([cell(1, 'error', null)])[0].message).toBe('Falha ao extrair resposta.');
  });
});

describe('matchesFilter', () => {
  it.each([
    ['pending', row(1, 1, 'Q'), true],
    ['pending', row(1, 1, 'Q', { status: 'error' }), false],
    ['reviewed', row(1, 1, 'Q', { review_status: 'edited' }), true],
    ['reviewed', row(1, 1, 'Q'), false],
    ['errors', row(1, 1, 'Q', { status: 'skipped' }), true],
    ['errors', row(1, 1, 'Q'), false],
    ['all', row(1, 1, 'Q', { status: 'error' }), true],
  ] as const)('%s', (filter, result, expected) => {
    expect(matchesFilter(result, filter)).toBe(expected);
  });
});

describe('nextPending', () => {
  const rows = [
    row(1, 1, 'Q'),
    row(2, 1, 'Q', { review_status: 'accepted' }),
    row(3, 1, 'Q', { status: 'error' }),
    row(4, 1, 'Q'),
  ];

  it('skips what is marked or failed, and answers null at the end', () => {
    expect(nextPending(rows, 1)?.id).toBe(4);
    expect(nextPending(rows, 4)).toBeNull();
  });
});

describe('gridOrder', () => {
  it('walks article by article, in the order of the questions', () => {
    const rows = [row(1, 1, 'Q2'), row(2, 2, 'Q1'), row(3, 1, 'Q1')];

    expect(gridOrder(rows, ['Q1', 'Q2']).map((r) => r.id)).toEqual([3, 1, 2]);
  });
});

describe('investigationPath', () => {
  it('builds the address of each view', () => {
    expect(investigationPath(3)).toBe('/projects/3/investigation');
    expect(investigationPath(3, 14)).toBe('/projects/3/investigation/14');
    expect(investigationPath(3, 'new')).toBe('/projects/3/investigation/new');
  });
});

describe('callMatrix', () => {
  const call = (articleId: number, question: string, status: CallCell['status']): CallCell => ({
    articleId,
    articleTitle: `A${articleId}`,
    question,
    status,
    error: null,
    answer: null,
    evidences: [],
  });

  it('lays the calls out as articles × questions, a missing call left empty', () => {
    const rows = callMatrix(
      [call(1, 'Q2', 'running'), call(1, 'Q1', 'success'), call(2, 'Q1', 'queued')],
      ['Q1', 'Q2'],
    );

    expect(rows.map((r) => r.articleTitle)).toEqual(['A1', 'A2']);
    expect(rows[0].calls.map((c) => c?.status)).toEqual(['success', 'running']);
    expect(rows[1].calls[1]).toBeUndefined();
  });
});

describe('evidencesOf', () => {
  it('reads the cited passages of a RAG answer, with their pages', () => {
    const answer = JSON.stringify({
      question: 'Q',
      synthesizedAnswer: 'Sim',
      confidenceScore: 0.9,
      evidences: [{ text: 'trecho', page: 26, bbox: null, reasoning: '' }],
    });

    expect(evidencesOf({ answer, quote: null })).toEqual([{ page: 26, text: 'trecho' }]);
  });

  it('falls back to the single quote of an older answer, and to nothing', () => {
    expect(evidencesOf({ answer: 'texto', quote: 'citação' })).toEqual([{ page: null, text: 'citação' }]);
    expect(evidencesOf({ answer: null, quote: null })).toEqual([]);
  });
});

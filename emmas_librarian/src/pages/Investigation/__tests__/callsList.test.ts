import { describe, expect, it } from 'vitest';
import { callAsText, callsSummary, failedCount, visibleCalls } from '../callsList';
import type { CallCell } from '../investigationView';
import { formatElapsed } from '../RunningView';

const call = (question: string, status: CallCell['status'], extra: Partial<CallCell> = {}): CallCell => ({
  articleId: 1,
  articleTitle: 'Estudo 1',
  question,
  status,
  error: null,
  answer: null,
  evidences: [],
  ...extra,
});

const cells = [
  call('Q1', 'success'),
  call('Q2', 'error', { error: '401' }),
  call('Q1', 'skipped'),
  call('Q2', 'success'),
];

describe('callsList', () => {
  it('numbers the calls in the full list, whatever the filter', () => {
    expect(visibleCalls(cells, 'errors', 'all').map((c) => c.number)).toEqual([2, 3]);
    expect(visibleCalls(cells, 'all', 'Q2').map((c) => c.number)).toEqual([2, 4]);
    expect(visibleCalls(cells, 'errors', 'Q2').map((c) => c.number)).toEqual([2]);
  });

  it('counts failed and skipped calls as errors and says how they went', () => {
    expect(failedCount(cells)).toBe(2);
    expect(callsSummary(cells)).toBe('4 chamadas · 2 com resposta, 2 sem');
    expect(callsSummary([call('Q1', 'success')])).toBe('1 chamada · todas responderam');
  });

  it('copies the question, the passage and the answer, or the error', () => {
    const answered = {
      number: 1,
      call: call('Q1', 'success', { answer: 'Sim', evidences: [{ page: 3, text: 'trecho' }] }),
    };
    const failed = { number: 2, call: call('Q2', 'error', { error: '401' }) };

    expect(callAsText(answered)).toBe('Chamada 1 — Estudo 1\nPergunta: Q1\nTrechos: [pág. 3] trecho\nResposta: Sim');
    expect(callAsText(failed)).toBe('Chamada 2 — Estudo 1\nPergunta: Q2\nTrechos: —\nErro: 401');
  });
});

describe('formatElapsed', () => {
  it('shows minutes and seconds, hours only when there are any', () => {
    expect(formatElapsed(161_000)).toBe('02:41');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
    expect(formatElapsed(-5)).toBe('00:00');
  });
});

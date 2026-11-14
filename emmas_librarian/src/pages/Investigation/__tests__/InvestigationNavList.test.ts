import { describe, expect, it } from 'vitest';
import { runPercent, savedDetails } from '../InvestigationNavList';
import { investigationSummary } from '../InvestigationDetail';
import { article, record } from './investigationTestData';

const targets = (n: number) => Array.from({ length: n }, (_, i) => article(i + 1));

describe('runPercent', () => {
  it('counts the article being asked as not done yet', () => {
    expect(runPercent({ current: 1, targets: targets(9) })).toBe(0);
    expect(runPercent({ current: 4, targets: targets(9) })).toBe(33);
  });

  it('is zero for a run with no articles', () => {
    expect(runPercent({ current: 0, targets: [] })).toBe(0);
  });
});

describe('savedDetails', () => {
  it('puts what the sidebar line leaves out in one line', () => {
    expect(savedDetails(record(2), 3, true)).toBe(
      'Sucesso · Ollama (gpt-oss:120b) · 2 artigos · 2 perguntas · 3 para revisar · auditada',
    );
  });

  it('leaves out review and audit when there is nothing to say', () => {
    expect(savedDetails(record(2, { status: '', model_used: '' }), 0, false)).toBe(
      'Status desconhecido · Modelo desconhecido · 2 artigos · 2 perguntas',
    );
  });
});

describe('investigationSummary', () => {
  it('says when it ran without seconds, the model and how much it covered', () => {
    const summary = investigationSummary(record(2, { created_at: '2026-08-08T05:55:05' }), 9, 4);

    expect(summary).toBe('08/08/2026, 05:55 · Ollama (gpt-oss:120b) · 9 artigos · 4 perguntas');
  });
});

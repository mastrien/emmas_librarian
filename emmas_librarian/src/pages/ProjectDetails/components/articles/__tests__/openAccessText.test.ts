import { describe, it, expect } from 'vitest';
import { openAccessMessage, reportGroups, type ReportEntry } from '../openAccessText';

describe('openAccessMessage', () => {
  it('describes each outcome, with the page of a blocked copy', () => {
    expect(openAccessMessage({ status: 'downloaded', source: 'arXiv' })).toEqual({
      tone: 'ok',
      text: 'PDF baixado. Fonte: arXiv.',
    });
    expect(openAccessMessage({ status: 'blocked', landingPages: ['https://a', 'https://b'] })).toMatchObject({
      tone: 'warning',
      page: 'https://a',
    });
    expect(openAccessMessage({ status: 'not-open' }).text).toBe('Nenhuma cópia aberta conhecida.');
    expect(openAccessMessage({ status: 'no-doi' }).text).toBe('Sem DOI para procurar a cópia aberta.');
    expect(openAccessMessage({ status: 'already' }).text).toBe('O artigo já tem PDF.');
    expect(openAccessMessage({ status: 'failed', error: 'Erro 503' })).toEqual({
      tone: 'error',
      text: 'Não foi possível procurar: Erro 503',
    });
  });
});

describe('reportGroups', () => {
  const entry = (articleId: number, outcome: ReportEntry['outcome']): ReportEntry => ({
    articleId,
    title: `A${articleId}`,
    outcome,
  });

  it('puts what needs the user right after the downloads and leaves out empty groups', () => {
    const groups = reportGroups([
      entry(1, { status: 'no-doi' }),
      entry(2, { status: 'blocked', landingPages: [] }),
      entry(3, { status: 'not-open' }),
      entry(4, { status: 'downloaded', source: 'arXiv' }),
    ]);

    expect(groups.map((g) => [g.label, g.entries.map((e) => e.articleId)])).toEqual([
      ['Baixados', [4]],
      ['Precisam de você', [2]],
      ['Sem cópia aberta ou sem DOI', [1, 3]],
    ]);
  });
});

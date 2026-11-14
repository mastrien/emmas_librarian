import { describe, expect, it } from 'vitest';
import { historyBasesLine, historyEntryTitle, historyWhen } from '../historyListItem';
import type { SearchHistoryItem } from '../../../../types';

const entry = (extra: Partial<SearchHistoryItem>) =>
  ({
    id: 12,
    unified_query: 'radar',
    translated_queries: '{}',
    results_breakdown: '{}',
    ...extra,
  }) as SearchHistoryItem;

describe('historyEntryTitle', () => {
  it('numbers a search and names an inclusion from outside the searches by what it recorded', () => {
    expect(historyEntryTitle(entry({ results_breakdown: '{"scopus":{"count":3}}' }))).toBe('Busca #12');
    expect(
      historyEntryTitle(
        entry({ unified_query: 'Importação de artigos do projeto A', results_breakdown: '{"import":{}}' }),
      ),
    ).toBe('Importação de artigos do projeto A');
  });
});

describe('historyBasesLine', () => {
  it('names the bases that answered', () => {
    expect(historyBasesLine(entry({ results_breakdown: '{"scopus":{},"openalex":{}}' }))).toBe('Scopus · OpenAlex');
    expect(historyBasesLine(entry({ results_breakdown: 'not json' }))).toBe('');
  });
});

describe('historyWhen', () => {
  it('writes day, month and time', () => {
    expect(historyWhen('2026-08-07T14:58:00')).toBe('07/08 14:58');
  });
});

import { describe, it, expect } from 'vitest';
import type { SearchHistoryItem } from '../../../../types';
import { historyLimitText, parseStoredObject, requestsText } from '../historyDetails';

const entry = (overrides: Partial<SearchHistoryItem>): SearchHistoryItem => ({
  id: 1,
  unified_query: 'q',
  translated_queries: '{}',
  total_results: 0,
  results_breakdown: '{}',
  created_at: '2026-09-28T12:00:00Z',
  ...overrides,
});

describe('parseStoredObject', () => {
  it('parses an object and turns anything else into an empty object', () => {
    expect(parseStoredObject('{"a":1}')).toEqual({ a: 1 });
    expect(parseStoredObject('{broken')).toEqual({});
    expect(parseStoredObject('[1,2]')).toEqual({});
    expect(parseStoredObject(null)).toEqual({});
  });
});

describe('historyLimitText', () => {
  it('shows the common limit with the per-base adjustments saved with the search', () => {
    const queryState = JSON.stringify({ limits: { common: 1000, perBase: { wos: 500, scopus: 2000 } } });

    expect(historyLimitText(entry({ limit_val: 1000, query_state: queryState }))).toBe(
      '1.000 por base (Web of Science 500, Scopus 2.000)',
    );
  });

  it('shows only the common limit for searches saved before adjustments, and nothing without a limit', () => {
    expect(historyLimitText(entry({ limit_val: 50 }))).toBe('50 por base');
    expect(historyLimitText(entry({}))).toBeNull();
  });
});

describe('requestsText', () => {
  it('lists the requests of each base that recorded them', () => {
    expect(requestsText({ openalex: { count: 1000, requests: 10 }, crossref: { count: 3 } })).toBe('OpenAlex 10');
    expect(requestsText({ crossref: { count: 3 } })).toBeNull();
  });
});

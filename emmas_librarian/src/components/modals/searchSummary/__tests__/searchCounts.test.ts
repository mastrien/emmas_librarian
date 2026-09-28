import { describe, expect, it } from 'vitest';
import { searchCounts } from '../searchCounts';
import type { SearchPreviewItem } from '../../../../types';

const result = (alreadyInProject: boolean): SearchPreviewItem => ({
  title: 't',
  sourceDatabases: ['OpenAlex'],
  alreadyInProject,
  details: {},
});

describe('searchCounts', () => {
  it('adds up: found - repeated - already in project = added', () => {
    const counts = searchCounts({
      previewId: 'p',
      breakdown: { openalex: { count: 4 }, scopus: { count: 3 }, crossref: { count: 0, error: 'HTTP 503' } },
      results: [result(false), result(false), result(false), result(true), result(true)],
    });

    expect(counts).toEqual({ found: 7, repeated: 2, alreadyInProject: 2, added: 3 });
    expect(counts.found - counts.repeated - counts.alreadyInProject).toBe(counts.added);
  });

  it('is all zero for a search that found nothing', () => {
    expect(searchCounts({ previewId: 'p', breakdown: { openalex: { count: 0 } }, results: [] })).toEqual({
      found: 0,
      repeated: 0,
      alreadyInProject: 0,
      added: 0,
    });
  });
});

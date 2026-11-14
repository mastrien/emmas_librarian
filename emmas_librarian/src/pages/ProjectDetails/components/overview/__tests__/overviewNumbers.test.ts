import { describe, expect, it } from 'vitest';
import {
  UNKNOWN_PUBLISHER,
  articlesPerBase,
  articlesPerPublisher,
  overviewTiles,
  percentOf,
  yearHistogram,
} from '../overviewNumbers';
import type { Article } from '../../../../../types';

const article = (extra: Partial<Article>): Article => ({ id: 1, project_id: 1, title: 'A', ...extra }) as Article;

describe('overviewTiles', () => {
  it('counts active, read, with PDF and open access articles', () => {
    const articles = [
      article({ status: 'new', is_oa: 1 }),
      article({ status: 'read', local_file_path: 'a.pdf' }),
      article({ status: 'archived', is_oa: 1 }),
      article({}),
    ];

    expect(overviewTiles(articles)).toEqual({ total: 4, active: 2, read: 1, withPdf: 1, openAccess: 2 });
  });
});

describe('percentOf', () => {
  it('rounds to a whole percentage and gives 0 for an empty project', () => {
    expect(percentOf(17, 96)).toBe(18);
    expect(percentOf(0, 0)).toBe(0);
  });
});

describe('yearHistogram', () => {
  it('fills the empty years between the first and the last and counts those without a year', () => {
    const articles = [article({ year: 2019 }), article({ year: 2021 }), article({ year: 2021 }), article({})];

    expect(yearHistogram(articles)).toEqual({
      bars: [
        { year: 2019, count: 1 },
        { year: 2020, count: 0 },
        { year: 2021, count: 2 },
      ],
      withoutYear: 1,
    });
  });

  it('has no bars when no article has a year', () => {
    expect(yearHistogram([article({})])).toEqual({ bars: [], withoutYear: 1 });
  });
});

describe('articlesPerBase', () => {
  it('counts an article under every base that found it, most frequent first', () => {
    const articles = [
      article({ source_databases: '["Scopus","OpenAlex"]' }),
      article({ source_databases: '["OpenAlex"]' }),
    ];

    expect(articlesPerBase(articles)).toEqual([
      { name: 'OpenAlex', count: 2 },
      { name: 'Scopus', count: 1 },
    ]);
  });
});

describe('articlesPerPublisher', () => {
  it('groups articles without a publisher under one muted label', () => {
    const articles = [article({ publisher: 'Wiley' }), article({ publisher: ' ' }), article({})];

    expect(articlesPerPublisher(articles)).toEqual([
      { name: UNKNOWN_PUBLISHER, count: 2 },
      { name: 'Wiley', count: 1 },
    ]);
  });
});

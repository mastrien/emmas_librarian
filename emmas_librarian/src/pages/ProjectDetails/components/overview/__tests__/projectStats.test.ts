import { describe, it, expect } from 'vitest';
import type { Article } from '../../../../../types';
import { articlesByDatabase, articlesByYear, doiCompleteness, openAccessSplit, topPublishers } from '../projectStats';

const article = (extra: Partial<Article>): Article => ({ id: 1, project_id: 1, title: 'T', ...extra }) as Article;

describe('project statistics (Arca 134)', () => {
  it('counts articles per year in text order, N/A without a year', () => {
    const series = articlesByYear([
      article({ year: 2020 }),
      article({ year: 2019 }),
      article({}),
      article({ year: 2020 }),
    ]);

    expect(series).toEqual({ labels: ['2019', '2020', 'N/A'], data: [1, 2, 1] });
  });

  it('splits open access, DOI and the first database of each article', () => {
    const articles = [
      article({ is_oa: 1, doi: '10.1/x', source_databases: '["openalex","scopus"]' }),
      article({ is_oa: 0, doi: '  ', source_databases: 'Manual' }),
      article({ source_databases: '["scopus"]' }),
    ];

    expect(openAccessSplit(articles).data).toEqual([1, 2]);
    expect(doiCompleteness(articles).data).toEqual([1, 2]);
    expect(articlesByDatabase(articles)).toEqual({ labels: ['openalex', 'Manual', 'scopus'], data: [1, 1, 1] });
  });

  it('keeps the ten publishers with most articles and cuts long names', () => {
    const many = Array.from({ length: 12 }, (_, i) => article({ publisher: `Editora ${i}` }));
    const series = topPublishers([
      ...many,
      article({ publisher: 'Uma editora de nome comprido' }),
      article({ publisher: 'Uma editora de nome comprido' }),
    ]);

    expect(series.labels).toHaveLength(10);
    expect(series.labels[0]).toBe('Uma editora de ...');
    expect(series.data[0]).toBe(2);
  });
});

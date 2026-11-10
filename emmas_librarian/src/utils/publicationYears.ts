import type { Article } from '../types';

// Publication years, shared by the overview's "Artigos por ano" and the year range of the article filters
// (redesign, boards 153 and 154), so both read years the same way.

/**
 * The article's publication year, or null when it has none (or a value that is not a year).
 *
 * @example publicationYear({ year: 2020 } as Article) // 2020
 */
export function publicationYear(article: Pick<Article, 'year'>): number | null {
  const year = Number(article.year);
  return Number.isInteger(year) && year > 0 ? year : null;
}

export interface YearHistogram {
  bars: { year: number; count: number }[];
  withoutYear: number;
}

/**
 * Articles per year from the first to the last year found, empty years included so the gaps show.
 *
 * @example yearHistogram(articles) // { bars: [{ year: 2019, count: 2 }, { year: 2020, count: 0 }, …], withoutYear: 3 }
 */
export function yearHistogram(articles: Pick<Article, 'year'>[]): YearHistogram {
  const years = articles.map(publicationYear);
  const known = years.filter((y): y is number => y !== null);
  const withoutYear = years.length - known.length;
  if (known.length === 0) return { bars: [], withoutYear };
  const first = Math.min(...known);
  const bars = Array.from({ length: Math.max(...known) - first + 1 }, (_, i) => ({
    year: first + i,
    count: known.filter((y) => y === first + i).length,
  }));
  return { bars, withoutYear };
}

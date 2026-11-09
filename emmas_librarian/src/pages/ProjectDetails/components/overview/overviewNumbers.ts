import type { Article } from '../../../../types';
import { parseSourceDatabases } from '../../../../utils/sourceDatabases';

// The compact numbers of the project overview (board 154): tiles, articles per year and two ranked lists. They
// replace the six Chart.js charts of the old Estatísticas tab.

export interface OverviewTiles {
  total: number;
  active: number;
  read: number;
  withPdf: number;
  openAccess: number;
}

/**
 * The four tile numbers; "active" is what is neither read nor archived, like the article list's "Ativos".
 *
 * @example overviewTiles(articles) // { total: 96, active: 89, read: 7, withPdf: 17, openAccess: 48 }
 */
export function overviewTiles(articles: Article[]): OverviewTiles {
  const count = (keep: (a: Article) => boolean) => articles.filter(keep).length;
  return {
    total: articles.length,
    active: count((a) => a.status !== 'read' && a.status !== 'archived'),
    read: count((a) => a.status === 'read'),
    withPdf: count((a) => Boolean(a.local_file_path)),
    openAccess: count((a) => a.is_oa === 1),
  };
}

/**
 * A share as a whole percentage, 0 for an empty project.
 *
 * @example percentOf(17, 96) // 18
 */
export function percentOf(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

export interface YearHistogram {
  bars: { year: number; count: number }[];
  withoutYear: number;
}

const yearOf = (a: Article): number | null => {
  const year = Number(a.year);
  return Number.isInteger(year) && year > 0 ? year : null;
};

/**
 * Articles per year from the first to the last year found, empty years included so the gaps show.
 *
 * @example yearHistogram(articles) // { bars: [{ year: 2019, count: 2 }, { year: 2020, count: 0 }, …], withoutYear: 3 }
 */
export function yearHistogram(articles: Article[]): YearHistogram {
  const years = articles.map(yearOf);
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

export interface RankedCount {
  name: string;
  count: number;
}

const ranked = (counts: Map<string, number>): RankedCount[] =>
  [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

/**
 * Articles per base, an article counted under every base that found it.
 *
 * @example articlesPerBase(articles) // [{ name: 'OpenAlex', count: 40 }, { name: 'Scopus', count: 40 }]
 */
export function articlesPerBase(articles: Article[]): RankedCount[] {
  const counts = new Map<string, number>();
  articles
    .flatMap((a) => parseSourceDatabases(a.source_databases))
    .forEach((base) => {
      counts.set(base, (counts.get(base) ?? 0) + 1);
    });
  return ranked(counts);
}

/** The label of articles with no publisher; listed apart, muted, since it is a gap and not a publisher. */
export const UNKNOWN_PUBLISHER = 'Desconhecida';

/**
 * Articles per publisher, the most frequent first.
 *
 * @example articlesPerPublisher(articles).slice(0, 3)
 */
export function articlesPerPublisher(articles: Article[]): RankedCount[] {
  const counts = new Map<string, number>();
  articles.forEach((a) => {
    const name = a.publisher?.trim() || UNKNOWN_PUBLISHER;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return ranked(counts);
}

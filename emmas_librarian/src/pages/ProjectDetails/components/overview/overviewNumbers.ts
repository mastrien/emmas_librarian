import type { Article } from '../../../../types';
import { parseSourceDatabases } from '../../../../utils/sourceDatabases';
export { yearHistogram, type YearHistogram } from '../../../../utils/publicationYears';

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

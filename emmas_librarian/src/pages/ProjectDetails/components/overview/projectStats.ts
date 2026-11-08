import type { Article } from '../../../../types';

/** One chart's labels and one dataset, as Chart.js takes them. */
export interface ChartSeries {
  labels: string[];
  data: number[];
}

function countBy(articles: Article[], keyOf: (article: Article) => string): Record<string, number> {
  return articles.reduce((acc: Record<string, number>, article) => {
    const key = keyOf(article);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Articles per publication year, years in text order, "N/A" for articles without one.
 *
 * @example articlesByYear(articles) // { labels: ['2019', '2020', 'N/A'], data: [3, 5, 1] }
 */
export function articlesByYear(articles: Article[]): ChartSeries {
  const sorted = Object.entries(countBy(articles, (a) => (a.year ? a.year.toString() : 'N/A'))).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return { labels: sorted.map(([year]) => year), data: sorted.map(([, count]) => count) };
}

/**
 * Open access articles against the others.
 *
 * @example openAccessSplit(articles) // { labels: ['Open Access', 'Closed / Não especificado'], data: [4, 9] }
 */
export function openAccessSplit(articles: Article[]): ChartSeries {
  const oa = articles.filter((a) => a.is_oa === 1).length;
  return { labels: ['Open Access', 'Closed / Não especificado'], data: [oa, articles.length - oa] };
}

// The first base of the stored JSON list, or the stored text itself when it is not a list.
function firstDatabase(article: Article): string {
  const stored = article.source_databases || 'Desconhecido';
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
  } catch {
    // Older articles keep a plain name instead of a JSON list.
  }
  return stored;
}

/**
 * Articles per database, counting each article under the first base that found it.
 *
 * @example articlesByDatabase(articles) // { labels: ['openalex', 'scopus'], data: [10, 3] }
 */
export function articlesByDatabase(articles: Article[]): ChartSeries {
  const counts = countBy(articles, firstDatabase);
  return { labels: Object.keys(counts), data: Object.values(counts) };
}

/**
 * The ten publishers with most articles, names cut at 15 characters.
 *
 * @example topPublishers(articles) // { labels: ['Elsevier', 'Springer Nature...'], data: [12, 7] }
 */
export function topPublishers(articles: Article[]): ChartSeries {
  const sorted = Object.entries(countBy(articles, (a) => a.publisher || 'Desconhecido'))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  return {
    labels: sorted.map(([name]) => (name.length > 15 ? name.substring(0, 15) + '...' : name)),
    data: sorted.map(([, count]) => count),
  };
}

/**
 * Articles with a DOI against those without one.
 *
 * @example doiCompleteness(articles) // { labels: ['Com DOI', 'Sem DOI'], data: [80, 9] }
 */
export function doiCompleteness(articles: Article[]): ChartSeries {
  const withDoi = articles.filter((a) => a.doi && a.doi.trim().length > 0).length;
  return { labels: ['Com DOI', 'Sem DOI'], data: [withDoi, articles.length - withDoi] };
}

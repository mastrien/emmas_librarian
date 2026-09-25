import type { Article } from '../../../types';

/**
 * ABNT-style "v. 1, n. 2, p. 3-4" with absent parts left out, or 'N/A' when all are absent.
 *
 * Usage:
 *   formatVolumeIssuePages({ volume: '7', pages: '9' }); // 'v. 7, p. 9'
 */
export function formatVolumeIssuePages(article: Pick<Article, 'volume' | 'issue' | 'pages'>): string {
  const parts = [
    article.volume && `v. ${article.volume}`,
    article.issue && `n. ${article.issue}`,
    article.pages && `p. ${article.pages}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'N/A';
}

/**
 * Non-empty, trimmed entries of a ";"-separated column (keywords, references).
 *
 * Usage:
 *   splitSemicolonList('a; ;b'); // ['a', 'b']
 */
export function splitSemicolonList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

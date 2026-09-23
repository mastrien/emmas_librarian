export const MANUAL_SOURCE = 'Manual';

/**
 * Reads an article's `source_databases` column. It is normally a JSON array of names, but legacy
 * or hand-edited rows may hold a single JSON value or a bare name; those are treated as one source.
 *
 * Usage:
 *   parseSourceDatabases('["Scopus","OpenAlex"]'); // ['Scopus', 'OpenAlex']
 */
export function parseSourceDatabases(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw !== 'string') return Array.isArray(raw) ? raw.map(String) : [String(raw)];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return [raw];
  }
}

/**
 * Whether the article was typed in by hand (its metadata may be incomplete or wrong).
 *
 * Usage:
 *   if (isManualArticle(article)) showEditButton();
 */
export function isManualArticle(article: { source_databases?: unknown }): boolean {
  return parseSourceDatabases(article.source_databases).includes(MANUAL_SOURCE);
}

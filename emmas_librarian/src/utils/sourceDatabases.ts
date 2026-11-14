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

// Short names for the narrow "Bases" column of the article table (redesign, board 153); the full name goes in
// the tooltip and is what screen readers say.
const SHORT_NAMES: Record<string, string> = {
  OpenAlex: 'OA',
  Scopus: 'SC',
  'Web of Science': 'WoS',
  Crossref: 'CR',
  'Europe PMC': 'EPMC',
  'IEEE Xplore': 'IEEE',
  arXiv: 'arXiv',
  Snowballing: 'Snow',
  import: 'Imp',
};

/**
 * The abbreviation of a base for compact lists; unknown names are kept as they are.
 *
 * Usage:
 *   baseShortName('Web of Science'); // 'WoS'
 */
export function baseShortName(base: string): string {
  return SHORT_NAMES[base] ?? base;
}

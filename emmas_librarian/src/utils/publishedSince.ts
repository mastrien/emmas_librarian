import { SEARCH_DATABASES } from '../pages/Search/searchQueries';

/** How finely a base filters by publication date; 'none' runs without the filter and the page says so. */
export type DateFilterPrecision = 'day' | 'year' | 'none';

// Checked on the real APIs for OpenAlex, Crossref, Europe PMC and arXiv (#52). Scopus documents only PUBYEAR; PY is the
// year field of Web of Science. IEEE stays out: its date parameters could not be confirmed in its documentation.
const PRECISION: Record<string, DateFilterPrecision> = {
  openalex: 'day',
  crossref: 'day',
  europepmc: 'day',
  arxiv: 'day',
  scopus: 'year',
  wos: 'year',
  ieee: 'none',
};

const precisionOf = (db: string): DateFilterPrecision => PRECISION[db] ?? 'none';

const yearOf = (isoDate: string) => Number(isoDate.slice(0, 4));
const compact = (isoDate: string) => isoDate.replaceAll('-', '');

function crossrefWithDate(query: string, since: string): string {
  const params = new URLSearchParams(query);
  const existing = params.get('filter');
  params.set('filter', existing ? `${existing},from-pub-date:${since}` : `from-pub-date:${since}`);
  return params.toString();
}

const WRITERS: Record<string, (query: string, since: string, today: string) => string> = {
  openalex: (q, since) => `${q},from_publication_date:${since}`,
  crossref: (q, since) => crossrefWithDate(q, since),
  europepmc: (q, since, today) => `(${q}) AND FIRST_PDATE:[${since} TO ${today}]`,
  arxiv: (q, since, today) => `(${q}) AND submittedDate:[${compact(since)}0000 TO ${compact(today)}2359]`,
  scopus: (q, since) => `(${q}) AND PUBYEAR > ${yearOf(since) - 1}`,
  wos: (q, since, today) => `(${q}) AND PY=${yearOf(since)}-${yearOf(today)}`,
};

/**
 * The queries with the publication date filter of each base. They are what goes to the base, so the history and the
 * strategy report (#45) record the filter exactly as sent. No date leaves them as they are.
 *
 * @example withPublishedSince({ scopus: 'TITLE(x)' }, '2026-03-01', '2026-11-02') // { scopus: '(TITLE(x)) AND PUBYEAR > 2025' }
 */
export function withPublishedSince(
  queries: Record<string, string>,
  since: string,
  today: string,
): Record<string, string> {
  if (!since) return queries;
  return Object.fromEntries(
    Object.entries(queries).map(([db, query]) => {
      const write = WRITERS[db];
      return [db, write ? write(query, since, today) : query];
    }),
  );
}

const namesOf = (dbs: string[]) => dbs.map((db) => SEARCH_DATABASES.find((d) => d.id === db)?.label ?? db).join(', ');

/**
 * What the date filter does on the chosen bases, in words, for the bases that do not apply the exact day.
 *
 * @example publishedSinceNote(['openalex', 'scopus', 'ieee'])
 *   // 'Scopus filtra só pelo ano. IEEE Xplore roda sem esse filtro.'
 */
export function publishedSinceNote(selected: string[]): string {
  const byYear = selected.filter((db) => precisionOf(db) === 'year');
  const none = selected.filter((db) => precisionOf(db) === 'none');
  const parts = [];
  if (byYear.length) parts.push(`${namesOf(byYear)} ${byYear.length === 1 ? 'filtra' : 'filtram'} só pelo ano.`);
  if (none.length) parts.push(`${namesOf(none)} ${none.length === 1 ? 'roda' : 'rodam'} sem esse filtro.`);
  return parts.join(' ');
}

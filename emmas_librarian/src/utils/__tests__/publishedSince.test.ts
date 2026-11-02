import { describe, expect, it } from 'vitest';
import { publishedSinceNote, withPublishedSince } from '../publishedSince';

const SINCE = '2026-03-01';
const TODAY = '2026-11-02';
const one = (db: string, query: string) => withPublishedSince({ [db]: query }, SINCE, TODAY)[db];

describe('withPublishedSince (#52)', () => {
  it('adds each base its own date filter', () => {
    expect(one('openalex', 'title.search:x')).toBe('title.search:x,from_publication_date:2026-03-01');
    expect(one('europepmc', 'TITLE:x')).toBe('(TITLE:x) AND FIRST_PDATE:[2026-03-01 TO 2026-11-02]');
    expect(one('arxiv', 'all:x')).toBe('(all:x) AND submittedDate:[202603010000 TO 202611022359]');
  });

  it('goes by the year where the base has no day', () => {
    expect(one('scopus', 'TITLE(x)')).toBe('(TITLE(x)) AND PUBYEAR > 2025');
    expect(one('wos', 'TS=x')).toBe('(TS=x) AND PY=2026-2026');
  });

  it('adds to the parameters of Crossref, keeping a filter it already has', () => {
    expect(new URLSearchParams(one('crossref', 'query.title=x')).get('filter')).toBe('from-pub-date:2026-03-01');
    const both = new URLSearchParams(one('crossref', 'query.title=x&filter=type:journal-article'));
    expect(both.get('query.title')).toBe('x');
    expect(both.get('filter')).toBe('type:journal-article,from-pub-date:2026-03-01');
  });

  it('leaves a base without a date filter as it is', () => {
    expect(one('ieee', '"x"')).toBe('"x"');
  });

  it('changes nothing without a date', () => {
    const queries = { openalex: 'q' };

    expect(withPublishedSince(queries, '', TODAY)).toBe(queries);
  });
});

describe('publishedSinceNote', () => {
  it('says nothing when every chosen base filters by the day', () => {
    expect(publishedSinceNote(['openalex', 'crossref', 'europepmc', 'arxiv'])).toBe('');
  });

  it('names the bases that go only by the year, and those that run without the filter', () => {
    expect(publishedSinceNote(['openalex', 'scopus'])).toBe('Scopus filtra só pelo ano.');
    expect(publishedSinceNote(['scopus', 'wos'])).toBe('Scopus, Web of Science filtram só pelo ano.');
    expect(publishedSinceNote(['ieee'])).toBe('IEEE Xplore roda sem esse filtro.');
  });
});

import { describe, expect, it } from 'vitest';
import {
  activeFilters,
  clearedFilters,
  countWith,
  matchesFilters,
  withoutFilter,
  type ArticleFilterCriteria,
} from '../articleFilters';
import type { Article } from '../../../../types';

const article = (overrides: Partial<Article>): Article => ({
  id: 1,
  project_id: 1,
  title: 'Radar e chuva',
  status: 'new',
  source_databases: '["OpenAlex"]',
  ...overrides,
});

const NONE: ArticleFilterCriteria = {
  searchTerm: '',
  onlyWithPdf: false,
  onlyWithoutPdf: false,
  onlyOpenAccess: false,
  statusFilter: 'new',
  databases: [],
  docType: '',
  keyword: '',
  yearFrom: null,
  yearTo: null,
  includeNoYear: false,
};

describe('matchesFilters', () => {
  it('matches title or authors, ignoring case', () => {
    expect(matchesFilters(article({ authors: 'Silva, A.' }), { ...NONE, searchTerm: 'SILVA' })).toBe(true);
    expect(matchesFilters(article({}), { ...NONE, searchTerm: 'neve' })).toBe(false);
  });

  it('treats an article without status as not read', () => {
    expect(matchesFilters(article({ status: undefined as unknown as Article['status'] }), NONE)).toBe(true);
    expect(matchesFilters(article({ status: 'read' }), NONE)).toBe(false);
    expect(matchesFilters(article({ status: 'read' }), { ...NONE, statusFilter: 'all' })).toBe(true);
  });

  it('keeps an article found in any of the selected bases', () => {
    const both = article({ source_databases: '["OpenAlex","Scopus"]' });

    expect(matchesFilters(both, { ...NONE, databases: ['Scopus', 'Crossref'] })).toBe(true);
    expect(matchesFilters(both, { ...NONE, databases: ['Crossref'] })).toBe(false);
  });

  it('applies PDF, open access, type and keyword together', () => {
    const a = article({
      local_file_path: '/a.pdf',
      is_oa: 1,
      document_type: 'article',
      author_keywords: 'Radar; Nowcasting',
    });
    const all = { ...NONE, onlyWithPdf: true, onlyOpenAccess: true, docType: 'article', keyword: 'nowcasting' };

    expect(matchesFilters(a, all)).toBe(true);
    expect(matchesFilters({ ...a, is_oa: 0 }, all)).toBe(false);
  });
});

describe('countWith', () => {
  it('counts what an option would leave on top of the current filters', () => {
    const articles = [
      article({ id: 1, source_databases: '["Scopus"]', local_file_path: '/a.pdf' }),
      article({ id: 2, source_databases: '["Scopus"]' }),
      article({ id: 3, source_databases: '["OpenAlex"]', local_file_path: '/b.pdf' }),
    ];

    expect(countWith(articles, { ...NONE, onlyWithPdf: true }, { databases: ['Scopus'] })).toBe(1);
    expect(countWith(articles, NONE, { databases: ['Scopus'] })).toBe(2);
  });
});

describe('activeFilters and withoutFilter', () => {
  const criteria: ArticleFilterCriteria = {
    ...NONE,
    searchTerm: 'radar',
    statusFilter: 'all',
    onlyWithPdf: true,
    databases: ['Scopus', 'Crossref'],
    docType: 'review',
    keyword: 'nowcasting',
  };

  it('lists one chip per filter, without the search text or the status (they have their own controls)', () => {
    const labels = activeFilters(criteria, (t) => (t === 'review' ? 'Revisão' : t)).map((f) => f.label);

    expect(labels).toEqual(['Com PDF', 'Scopus', 'Crossref', 'Revisão', '"nowcasting"']);
    expect(activeFilters(NONE)).toEqual([]);
  });

  it('removes exactly the chip that was clicked', () => {
    expect(withoutFilter(criteria, 'database:Scopus').databases).toEqual(['Crossref']);
    expect(withoutFilter(criteria, 'keyword').keyword).toBe('');
  });

  it('clears every filter but keeps the search text and the status', () => {
    expect(clearedFilters(criteria)).toEqual({ ...NONE, searchTerm: 'radar', statusFilter: 'all' });
  });
});

describe('"Sem PDF" (validation of epic #44)', () => {
  const withPdf = { id: 1, title: 'Com', local_file_path: 'a.pdf', status: 'new' } as Article;
  const without = { id: 2, title: 'Sem', local_file_path: null, status: 'new' } as unknown as Article;

  it('keeps only the articles still without a PDF', () => {
    expect([withPdf, without].filter((a) => matchesFilters(a, { ...NONE, onlyWithoutPdf: true }))).toEqual([without]);
  });

  it('shows as a chip that can be removed, and goes with "Limpar filtros"', () => {
    const on = { ...NONE, onlyWithoutPdf: true };

    expect(activeFilters(on)).toContainEqual({ key: 'noPdf', label: 'Sem PDF' });
    expect(withoutFilter(on, 'noPdf').onlyWithoutPdf).toBe(false);
    expect(clearedFilters(on).onlyWithoutPdf).toBe(false);
  });
});

describe('year range (board 153)', () => {
  const y2004 = article({ id: 1, year: 2004 });
  const y2010 = article({ id: 2, year: 2010 });
  const noYear = article({ id: 3 });
  const kept = (c: ArticleFilterCriteria) =>
    [y2004, y2010, noYear].filter((a) => matchesFilters(a, c)).map((a) => a.id);

  it('keeps every article while no range is set', () => {
    expect(kept(NONE)).toEqual([1, 2, 3]);
  });

  it('keeps the years inside the range, both ends included, and drops those without a year', () => {
    expect(kept({ ...NONE, yearFrom: 2005, yearTo: 2010 })).toEqual([2]);
    expect(kept({ ...NONE, yearTo: 2004 })).toEqual([1]);
  });

  it('brings the articles without a year back on request', () => {
    expect(kept({ ...NONE, yearFrom: 2005, includeNoYear: true })).toEqual([2, 3]);
  });

  it('shows as one chip that removes the whole range', () => {
    const on = { ...NONE, yearFrom: 2005, yearTo: 2026, includeNoYear: true };

    expect(activeFilters(on)).toEqual([{ key: 'year', label: '2005–2026' }]);
    expect(activeFilters({ ...NONE, yearFrom: 2005 })[0].label).toBe('desde 2005');
    expect(withoutFilter(on, 'year')).toEqual(NONE);
  });
});

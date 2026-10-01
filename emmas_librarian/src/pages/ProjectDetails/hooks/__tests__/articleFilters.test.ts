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
  onlyOpenAccess: false,
  statusFilter: 'new',
  databases: [],
  docType: '',
  keyword: '',
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

  it('lists one chip per filter, without the search text or the default status', () => {
    const labels = activeFilters(criteria, (t) => (t === 'review' ? 'Revisão' : t)).map((f) => f.label);

    expect(labels).toEqual(['Todos', 'Com PDF', 'Scopus', 'Crossref', 'Revisão', '"nowcasting"']);
    expect(activeFilters(NONE)).toEqual([]);
  });

  it('removes exactly the chip that was clicked', () => {
    expect(withoutFilter(criteria, 'database:Scopus').databases).toEqual(['Crossref']);
    expect(withoutFilter(criteria, 'status').statusFilter).toBe('new');
    expect(withoutFilter(criteria, 'keyword').keyword).toBe('');
  });

  it('clears every filter but keeps the search text', () => {
    expect(clearedFilters(criteria)).toEqual({ ...NONE, searchTerm: 'radar' });
  });
});

import { describe, it, expect } from 'vitest';
import type { Article, SearchHistoryItem } from '../../../../types';
import {
  matchesSearch,
  matchesTerm,
  parseSearchFilter,
  searchBadgeLabel,
  searchFilterOptions,
  sortArticles,
} from '../articleSelectorQueries';

const article = (over: Partial<Article> & { id: number }): Article =>
  ({ title: `T${over.id}`, authors: '', status: 'new', ...over }) as Article;
const search = (id: number, query: string) => ({ id, unified_query: query }) as SearchHistoryItem;

describe('matchesTerm', () => {
  const a = article({ id: 1, title: 'Radar', authors: 'Lima', year: 2021, publisher: 'IEEE', doi: '10.1/X' });

  it('finds the term in title, authors, year, publisher or DOI, ignoring case', () => {
    expect(['radar', 'LIMA', '2021', 'ieee', '10.1/x', '  '].map((t) => matchesTerm(a, t))).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(matchesTerm(a, 'sonar')).toBe(false);
  });
});

describe('matchesSearch', () => {
  it('keeps every article, one search, or those from no search', () => {
    const fromSearch = article({ id: 1, search_id: 3 });
    const manual = article({ id: 2 });
    expect([matchesSearch(fromSearch, 'all'), matchesSearch(fromSearch, 3), matchesSearch(fromSearch, 4)]).toEqual([
      true,
      true,
      false,
    ]);
    expect([matchesSearch(manual, 'none'), matchesSearch(fromSearch, 'none')]).toEqual([true, false]);
  });
});

describe('sortArticles', () => {
  it('sorts a copy by title, year, authors or origin', () => {
    const list = [
      article({ id: 1, title: 'B', year: 2020, search_id: 1 }),
      article({ id: 2, title: 'A', year: 2022, search_id: 5 }),
    ];
    expect(sortArticles(list, 'title-asc').map((a) => a.id)).toEqual([2, 1]);
    expect(sortArticles(list, 'year-asc').map((a) => a.id)).toEqual([1, 2]);
    expect(sortArticles(list, 'search-id').map((a) => a.id)).toEqual([2, 1]);
    expect(list.map((a) => a.id)).toEqual([1, 2]);
  });
});

describe('searchBadgeLabel', () => {
  it('names the search, cuts a long query, and marks unknown or missing searches', () => {
    const history = [search(3, 'machine learning OR artificial intelligence')];
    expect(searchBadgeLabel(3, history)).toBe('#3: machine learning OR artif...');
    expect(searchBadgeLabel(7, history)).toBe('Busca #7');
    expect(searchBadgeLabel(undefined, history)).toBe('Manual / Importação');
  });
});

describe('searchFilterOptions', () => {
  it('lists the history, searches missing from it and the articles from none, with counts', () => {
    const articles = [article({ id: 1, search_id: 3 }), article({ id: 2, search_id: 9 }), article({ id: 3 })];
    expect(searchFilterOptions(articles, [search(3, 'radar')])).toEqual([
      { id: 3, label: '#3: radar', count: 1 },
      { id: 9, label: 'Busca #9', count: 1 },
      { id: 'none', label: 'Manual / Sem busca no histórico', count: 1 },
    ]);
  });
});

describe('parseSearchFilter', () => {
  it('reads the dropdown value back', () => {
    expect([parseSearchFilter('all'), parseSearchFilter('none'), parseSearchFilter('12')]).toEqual(['all', 'none', 12]);
  });
});

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useArticleFilters } from './useArticleFilters';
import { Article } from '../types';

describe('useArticleFilters', () => {
  const mockArticles = [
    {
      id: 1,
      title: 'First Article',
      abstract: 'An abstract about React',
      authors: 'John Doe',
      status: 'read',
      search_id: 101,
      source_databases: 'pubmed',
      local_file_path: '/path/to/pdf1.pdf',
      project_id: 1,
      created_at: '',
    },
    {
      id: 2,
      title: 'Second Article',
      abstract: 'An abstract about Vue',
      authors: 'Jane Smith',
      status: 'new',
      search_id: undefined,
      source_databases: undefined,
      local_file_path: undefined,
      project_id: 1,
      created_at: '',
    },
    {
      id: 3,
      title: 'Third Article',
      abstract: 'Nothing interesting',
      authors: 'Jim Bob',
      status: 'archived',
      search_id: 102,
      source_databases: 'arXiv',
      local_file_path: undefined,
      project_id: 1,
      created_at: '',
    },
    {
      id: 4,
      title: undefined,
      abstract: undefined,
      authors: undefined,
      status: 'new',
      search_id: undefined,
      source_databases: undefined,
      local_file_path: undefined,
      project_id: 1,
      created_at: '',
    }
  ] as unknown as Article[];

  const mockCategories: Record<number, number[]> = {
    1: [10, 20],
    2: [10],
    3: [30],
  };

  it('initializes with default values and returns all articles', () => {
    const { result } = renderHook(() => useArticleFilters(mockArticles, mockCategories));

    expect(result.current.selectedStatus).toBe('');
    expect(result.current.selectedDatabase).toBe('');
    expect(result.current.selectedDocType).toBe('');
    expect(result.current.selectedKeyword).toBe('');
    expect(result.current.selectedCategory).toBeNull();
    expect(result.current.filteredArticles).toHaveLength(4);
  });

  it('filters by status', () => {
    const { result } = renderHook(() => useArticleFilters(mockArticles, mockCategories));

    act(() => {
      result.current.setSelectedStatus('read');
    });

    expect(result.current.filteredArticles).toHaveLength(1);
    expect(result.current.filteredArticles[0].id).toBe(1);
  });

  it('filters by database (MANUAL)', () => {
    const { result } = renderHook(() => useArticleFilters(mockArticles, mockCategories));

    act(() => {
      result.current.setSelectedDatabase('MANUAL');
    });

    expect(result.current.filteredArticles).toHaveLength(2);
    expect(result.current.filteredArticles.map(a => a.id)).toEqual([2, 4]);
  });

  it('filters by database (specific)', () => {
    const { result } = renderHook(() => useArticleFilters(mockArticles, mockCategories));

    act(() => {
      result.current.setSelectedDatabase('ARXIV');
    });

    expect(result.current.filteredArticles).toHaveLength(1);
    expect(result.current.filteredArticles[0].id).toBe(3);
  });

  it('filters by document type (with_pdf)', () => {
    const { result } = renderHook(() => useArticleFilters(mockArticles, mockCategories));

    act(() => {
      result.current.setSelectedDocType('with_pdf');
    });

    expect(result.current.filteredArticles).toHaveLength(1);
    expect(result.current.filteredArticles[0].id).toBe(1);
  });

  it('filters by document type (without_pdf)', () => {
    const { result } = renderHook(() => useArticleFilters(mockArticles, mockCategories));

    act(() => {
      result.current.setSelectedDocType('without_pdf');
    });

    expect(result.current.filteredArticles).toHaveLength(3);
    expect(result.current.filteredArticles.map(a => a.id)).toEqual([2, 3, 4]);
  });

  it('filters by category', () => {
    const { result } = renderHook(() => useArticleFilters(mockArticles, mockCategories));

    act(() => {
      result.current.setSelectedCategory(10);
    });

    expect(result.current.filteredArticles).toHaveLength(2);
    expect(result.current.filteredArticles.map(a => a.id)).toEqual([1, 2]);

    act(() => {
      result.current.setSelectedCategory(99); // non-existent category
    });
    expect(result.current.filteredArticles).toHaveLength(0);
  });

  it('filters by keyword (title)', () => {
    const { result } = renderHook(() => useArticleFilters(mockArticles, mockCategories));

    act(() => {
      result.current.setSelectedKeyword('Third');
    });

    expect(result.current.filteredArticles).toHaveLength(1);
    expect(result.current.filteredArticles[0].id).toBe(3);
  });

  it('filters by keyword (abstract)', () => {
    const { result } = renderHook(() => useArticleFilters(mockArticles, mockCategories));

    act(() => {
      result.current.setSelectedKeyword('Vue');
    });

    expect(result.current.filteredArticles).toHaveLength(1);
    expect(result.current.filteredArticles[0].id).toBe(2);
  });

  it('filters by keyword (authors)', () => {
    const { result } = renderHook(() => useArticleFilters(mockArticles, mockCategories));

    act(() => {
      result.current.setSelectedKeyword('Doe');
    });

    expect(result.current.filteredArticles).toHaveLength(1);
    expect(result.current.filteredArticles[0].id).toBe(1);
  });

  it('handles empty fields when filtering by keyword', () => {
    const { result } = renderHook(() => useArticleFilters(mockArticles, mockCategories));

    act(() => {
      // Something that doesn't match article 4 which has null title/abstract/authors
      result.current.setSelectedKeyword('NotFound');
    });

    expect(result.current.filteredArticles).toHaveLength(0);
  });
});

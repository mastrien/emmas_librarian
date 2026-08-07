import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useProjectMetrics } from './useProjectMetrics';
import { Article } from '../types';

describe('useProjectMetrics', () => {
  it('calculates metrics correctly for an empty array', () => {
    const emptyArray: Article[] = [];
    const { result } = renderHook(() => useProjectMetrics(emptyArray));
    expect(result.current).toEqual({
      total: 0,
      read: 0,
      new: 0,
      archived: 0,
      withPdf: 0,
    });
  });

  it('calculates metrics correctly for a given set of articles', () => {
    const mockArticles = [
      { id: 1, status: 'new', local_file_path: '/path.pdf' },
      { id: 2, status: 'read', local_file_path: null },
      { id: 3, status: 'new', local_file_path: null },
      { id: 4, status: 'archived', local_file_path: '/another.pdf' },
      { id: 5, status: 'read', local_file_path: '/yep.pdf' },
      { id: 6, status: 'unknown', local_file_path: null },
    ] as unknown as Article[];

    const { result, rerender } = renderHook(
      ({ articles }) => useProjectMetrics(articles),
      { initialProps: { articles: mockArticles } }
    );

    expect(result.current).toEqual({
      total: 6,
      read: 2,
      new: 2,
      archived: 1,
      withPdf: 3,
    });

    // Test re-render with new data
    rerender({ articles: [mockArticles[0]] });
    expect(result.current).toEqual({
      total: 1,
      read: 0,
      new: 1,
      archived: 0,
      withPdf: 1,
    });
  });
});

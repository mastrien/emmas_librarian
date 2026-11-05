import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pageCount, pageNumbers } from '../pageNumbers';
import { usePagedRows } from '../../hooks/usePagedRows';

describe('pageNumbers', () => {
  it.each([
    [1, 1, [1]],
    [1, 3, [1, 2, 3]],
    [5, 10, [1, 'gap', 4, 5, 6, 'gap', 10]],
    [1, 10, [1, 2, 'gap', 10]],
    [10, 10, [1, 'gap', 9, 10]],
    [3, 10, [1, 2, 3, 4, 'gap', 10]],
  ])('page %i of %i shows %j', (current, total, shown) => {
    expect(pageNumbers(current, total)).toEqual(shown);
  });
});

describe('pageCount', () => {
  it.each([
    [0, 1],
    [50, 1],
    [51, 2],
    [101, 3],
  ])('%i items take %i pages of 50', (items, pages) => {
    expect(pageCount(items, 50)).toBe(pages);
  });
});

describe('usePagedRows', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  it('gives the rows of the page in view', () => {
    const { result } = renderHook(() => usePagedRows(rows(120), 50));

    act(() => result.current.setPage(3));

    expect(result.current).toMatchObject({ page: 3, pages: 3, rows: rows(120).slice(100) });
  });

  // Deciding the last article of the last page must not leave an empty page.
  it('falls back to the last page when the list shrinks below the page in view', () => {
    const { result, rerender } = renderHook(({ n }) => usePagedRows(rows(n), 50), { initialProps: { n: 101 } });
    act(() => result.current.setPage(3));

    rerender({ n: 100 });

    expect(result.current.page).toBe(2);
    expect(result.current.rows).toHaveLength(50);
  });
});

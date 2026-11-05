import { useState } from 'react';
import { pageCount } from '../utils/pageNumbers';

/**
 * One page of a list. When the list shrinks below the page in view, as when the last article of a page is decided,
 * the last page is shown instead of an empty one.
 *
 * @example const paged = usePagedRows(group.rows, 50); paged.rows.map(...)
 */
export function usePagedRows<T>(rows: T[], size: number) {
  const [wanted, setPage] = useState(1);
  const pages = pageCount(rows.length, size);
  const page = Math.min(wanted, pages);
  return { rows: rows.slice((page - 1) * size, page * size), page, pages, setPage };
}

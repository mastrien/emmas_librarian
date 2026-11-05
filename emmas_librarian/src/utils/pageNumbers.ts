/** A page number to show, or a gap where several were left out. */
export type PageMark = number | 'gap';

/**
 * The page numbers worth a button: the first, the last, and the ones around the current, with gaps between.
 *
 * @example pageNumbers(5, 10) // [1, 'gap', 4, 5, 6, 'gap', 10]
 */
export function pageNumbers(current: number, total: number): PageMark[] {
  const wanted = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? (['gap', n] as PageMark[]) : [n]));
}

/**
 * How many pages a list takes.
 *
 * @example pageCount(101, 50) // 3
 */
export const pageCount = (items: number, size: number): number => Math.max(1, Math.ceil(items / size));

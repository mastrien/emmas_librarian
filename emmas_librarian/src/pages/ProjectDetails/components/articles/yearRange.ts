import type { YearHistogram } from '../../../../utils/publicationYears';
import type { ArticleFilterCriteria } from '../../hooks/articleFilters';

export interface YearRangeView {
  /** The first and last years any article has: the ends of the slider. */
  first: number;
  last: number;
  /** The chosen range, the ends when no limit is set. */
  from: number;
  to: number;
}

/**
 * Where the slider stands: the chosen years, or the ends of the histogram where no limit is set.
 *
 * @example yearRangeOf(histogram, { ...criteria, yearFrom: 2005 }) // { first: 1992, last: 2026, from: 2005, to: 2026 }
 */
export function yearRangeOf(
  histogram: YearHistogram,
  c: Pick<ArticleFilterCriteria, 'yearFrom' | 'yearTo'>,
): YearRangeView {
  const first = histogram.bars[0]?.year ?? 0;
  const last = histogram.bars[histogram.bars.length - 1]?.year ?? 0;
  return { first, last, from: c.yearFrom ?? first, to: c.yearTo ?? last };
}

/**
 * The criteria for a range the user picked: kept inside the histogram, the ends never crossed, and an end at the
 * edge stored as "no limit", so dragging back to the full range turns the filter off.
 *
 * @example clampYearRange(histogram, 2005, 2030) // { yearFrom: 2005, yearTo: null }
 */
export function clampYearRange(
  histogram: YearHistogram,
  from: number,
  to: number,
): Pick<ArticleFilterCriteria, 'yearFrom' | 'yearTo'> {
  const { first, last } = yearRangeOf(histogram, { yearFrom: null, yearTo: null });
  const lo = Math.min(Math.max(from, first), last);
  const hi = Math.max(Math.min(to, last), lo);
  return { yearFrom: lo <= first ? null : lo, yearTo: hi >= last ? null : hi };
}

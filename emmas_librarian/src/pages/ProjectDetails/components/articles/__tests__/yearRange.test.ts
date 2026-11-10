import { describe, expect, it } from 'vitest';
import { clampYearRange, yearRangeOf } from '../yearRange';

const histogram = {
  bars: [1992, 1993, 1994, 1995].map((year) => ({ year, count: 1 })),
  withoutYear: 2,
};

describe('yearRangeOf', () => {
  it('stands at the ends of the histogram where no limit is set', () => {
    expect(yearRangeOf(histogram, { yearFrom: null, yearTo: 1994 })).toEqual({
      first: 1992,
      last: 1995,
      from: 1992,
      to: 1994,
    });
  });
});

describe('clampYearRange', () => {
  it('stores an end at the edge as "no limit", so the full range turns the filter off', () => {
    expect(clampYearRange(histogram, 1992, 1995)).toEqual({ yearFrom: null, yearTo: null });
  });

  it('keeps the range inside the histogram', () => {
    expect(clampYearRange(histogram, 1980, 2030)).toEqual({ yearFrom: null, yearTo: null });
    expect(clampYearRange(histogram, 1993, 2030)).toEqual({ yearFrom: 1993, yearTo: null });
  });

  it('never lets the end come before the start', () => {
    expect(clampYearRange(histogram, 1994, 1993)).toEqual({ yearFrom: 1994, yearTo: 1994 });
  });
});

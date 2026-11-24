import { describe, it, expect } from 'vitest';
import { monthGrid, neighbour, openingDate, pageDates } from '../diaryPages';

const entry = (date: string) => ({ id: 1, project_id: 1, entry_date: date, content: '' });

describe('pageDates', () => {
  it('lists the pages oldest first and adds today only where it can be written', () => {
    const entries = [entry('2026-11-12'), entry('2026-11-10')];
    expect(pageDates(entries, '2026-11-14', true)).toEqual(['2026-11-10', '2026-11-12', '2026-11-14']);
    expect(pageDates(entries, '2026-11-14', false)).toEqual(['2026-11-10', '2026-11-12']);
  });

  it('does not repeat today when it already has a page', () => {
    expect(pageDates([entry('2026-11-14')], '2026-11-14', true)).toEqual(['2026-11-14']);
  });
});

describe('openingDate', () => {
  it('is today where writing is possible, and the newest page otherwise', () => {
    expect(openingDate([entry('2026-11-10')], '2026-11-14', true)).toBe('2026-11-14');
    expect(openingDate([entry('2026-11-10'), entry('2026-11-12')], '2026-11-14', false)).toBe('2026-11-12');
    expect(openingDate([], '2026-11-14', false)).toBeNull();
  });
});

describe('neighbour', () => {
  const dates = ['2026-11-10', '2026-11-12', '2026-11-14'];
  it('finds the page before and after, and null at the ends', () => {
    expect(neighbour(dates, '2026-11-12', -1)).toBe('2026-11-10');
    expect(neighbour(dates, '2026-11-12', 1)).toBe('2026-11-14');
    expect(neighbour(dates, '2026-11-10', -1)).toBeNull();
    expect(neighbour(dates, '2026-11-14', 1)).toBeNull();
  });

  it('works from a date that has no page', () => {
    expect(neighbour(dates, '2026-11-11', -1)).toBe('2026-11-10');
    expect(neighbour(dates, '2026-11-11', 1)).toBe('2026-11-12');
  });
});

describe('monthGrid', () => {
  it('lays November 2026 out: it starts on a Sunday and has 30 days', () => {
    const grid = monthGrid('2026-11-21');
    expect(grid.leadingBlanks).toBe(0);
    expect(grid.days).toHaveLength(30);
    expect(grid.days[0]).toBe('2026-11-01');
    expect(grid.title).toBe('novembro de 2026');
  });

  it('leaves blanks before day 1 when the month does not start on Sunday', () => {
    expect(monthGrid('2026-12-05').leadingBlanks).toBe(2);
  });

  it('knows February of a leap year', () => {
    expect(monthGrid('2028-02-10').days).toHaveLength(29);
  });
});

import { describe, it, expect } from 'vitest';
import { reorderedItems } from '../documentReorder';

const items = ['a', 'b', 'c'];

describe('reorderedItems', () => {
  it.each([
    [0, 2, ['b', 'a', 'c']],
    [0, 3, ['b', 'c', 'a']],
    [2, 0, ['c', 'a', 'b']],
    [2, 1, ['a', 'c', 'b']],
  ])('moves item %i into gap %i', (source, gap, expected) => {
    expect(reorderedItems(items, source, gap)).toEqual(expected);
  });

  it.each([
    [1, 1],
    [1, 2],
  ])('returns null when item %i dropped in gap %i stays in place', (source, gap) => {
    expect(reorderedItems(items, source, gap)).toBeNull();
  });

  it.each([
    [-1, 0],
    [3, 0],
    [0, null],
    [0, -1],
    [0, 4],
  ])('returns null for out-of-range source %s or gap %s', (source, gap) => {
    expect(reorderedItems(items, source, gap)).toBeNull();
  });

  it('does not mutate the input', () => {
    reorderedItems(items, 0, 3);

    expect(items).toEqual(['a', 'b', 'c']);
  });
});

import { describe, it, expect } from 'vitest';
import { parseJsonList } from '../parseJsonList';

describe('parseJsonList', () => {
  it('parses a JSON array', () => {
    expect(parseJsonList<number>('[1,2]')).toEqual([1, 2]);
  });

  it.each([undefined, null, '', '{bad', '{"a":1}', '"text"'])('returns [] for %s', (raw) => {
    expect(parseJsonList(raw)).toEqual([]);
  });
});

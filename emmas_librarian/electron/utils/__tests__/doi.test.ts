import { describe, expect, it } from 'vitest';
import { doiKey } from '../doi';

describe('doiKey', () => {
  it.each([
    ['10.1016/J.ENV.2024', '10.1016/j.env.2024'],
    ['  10.1/abc  ', '10.1/abc'],
    ['https://doi.org/10.1/ABC', '10.1/abc'],
    ['http://dx.doi.org/10.1/abc', '10.1/abc'],
    ['', ''],
    [null, ''],
    [undefined, ''],
  ])('%s -> %s', (raw, expected) => {
    expect(doiKey(raw)).toBe(expected);
  });
});

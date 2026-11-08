import { describe, it, expect } from 'vitest';
import { fillHeightStyle } from './useFillWindowHeight';

describe('fillHeightStyle', () => {
  it('hands the measured height to the page as --fill-height, and nothing before the first measure', () => {
    expect(fillHeightStyle(640)).toEqual({ '--fill-height': '640px' });
    expect(fillHeightStyle(undefined)).toBeUndefined();
  });
});

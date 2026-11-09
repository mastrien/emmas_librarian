import { describe, it, expect } from 'vitest';
import { contrastRatio, hexToRgb, relativeLuminance } from '../contrast';

describe('hexToRgb', () => {
  it('reads the three channels of a six-digit colour', () => {
    expect(hexToRgb('#4f46e5')).toEqual([79, 70, 229]);
  });

  it('names the bad value and the expected shape', () => {
    expect(() => hexToRgb('#fff')).toThrow('hexToRgb expects a colour like "#1a2b3c", got "#fff"');
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBe(1);
  });
});

describe('contrastRatio', () => {
  it('is 21 between black and white in either order', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#ffffff', '#000000')).toBe(21);
  });

  it('matches the published ratio of Slate 500 on white', () => {
    expect(contrastRatio('#64748b', '#ffffff')).toBeCloseTo(4.76, 2);
  });
});

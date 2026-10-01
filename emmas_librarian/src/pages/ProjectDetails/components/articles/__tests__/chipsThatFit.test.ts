import { describe, expect, it } from 'vitest';
import { chipsThatFit } from '../chipsThatFit';

describe('chipsThatFit', () => {
  it('keeps every chip when they all fit with "Limpar"', () => {
    // 3 chips of 80 + gaps of 6 + "Limpar" 50 = 308
    expect(chipsThatFit([80, 80, 80], 308, 60, 50, 6)).toBe(3);
  });

  it('leaves room for the "+N" button when some chips must go', () => {
    // 1 chip (86) + "+N" (66) + "Limpar" (50) = 202 fits in 210; 2 chips would need 288
    expect(chipsThatFit([80, 80, 80], 210, 60, 50, 6)).toBe(1);
  });

  it('can show only "+N" when not even one chip fits', () => {
    expect(chipsThatFit([300, 80], 150, 60, 50, 6)).toBe(0);
  });

  it('has nothing to fit without chips', () => {
    expect(chipsThatFit([], 100, 60, 50, 6)).toBe(0);
  });
});

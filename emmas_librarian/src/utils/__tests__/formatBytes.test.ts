import { describe, it, expect } from 'vitest';
import { formatBytes } from '../formatters';

describe('formatBytes', () => {
  it('names the size in the largest unit that keeps it above 1, with up to two decimals', () => {
    expect([0, 512, 1536, 5 * 1024 * 1024, 1234567890].map(formatBytes)).toEqual([
      '0 Bytes',
      '512 Bytes',
      '1.5 KB',
      '5 MB',
      '1.15 GB',
    ]);
  });
});

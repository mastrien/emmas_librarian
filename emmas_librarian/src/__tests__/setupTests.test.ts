import { getConfig } from '@testing-library/dom';
import { describe, it, expect } from 'vitest';

// The shared wait set in setupTests.ts reaches every suite (CI flakes of #48 and #49).
describe('test setup', () => {
  it('lets findBy and waitFor wait up to 4 s', () => {
    expect(getConfig().asyncUtilTimeout).toBe(4000);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { localIsoDate } from '../localDate';

describe('localIsoDate', () => {
  const originalTz = process.env.TZ;

  // Brazil (UTC-3) is where the off-by-one showed up: after 21:00 the UTC date is already tomorrow.
  beforeEach(() => {
    process.env.TZ = 'America/Sao_Paulo';
  });

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('returns the local calendar day late in the evening, not the UTC one', () => {
    const lateEvening = new Date(2026, 8, 26, 22, 30);

    expect(localIsoDate(lateEvening)).toBe('2026-09-26');
  });

  it('pads month and day with zeros', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 9))).toBe('2026-01-05');
  });
});

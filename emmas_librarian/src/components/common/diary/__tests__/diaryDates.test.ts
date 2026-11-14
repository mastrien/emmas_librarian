import { describe, it, expect } from 'vitest';
import { parseDbTimestamp, versionStamp } from '../diaryDates';

describe('parseDbTimestamp', () => {
  it('reads the database text as UTC, which is what CURRENT_TIMESTAMP writes', () => {
    expect(parseDbTimestamp('2026-03-05 21:42:10').toISOString()).toBe('2026-03-05T21:42:10.000Z');
  });

  it('leaves a timestamp that already has a zone as it is', () => {
    expect(parseDbTimestamp('2026-03-05T21:42:10Z').toISOString()).toBe('2026-03-05T21:42:10.000Z');
    expect(parseDbTimestamp('2026-03-05T21:42:10-03:00').toISOString()).toBe('2026-03-06T00:42:10.000Z');
  });
});

describe('versionStamp', () => {
  // Noon UTC on the 5th is the 5th everywhere from UTC-11 to UTC+11, so the day names below do not depend on the zone.
  const saved = '2026-03-05 12:00:00';
  const at = (day: number, month = 2, year = 2026) => new Date(year, month, day, 12, 0);

  it('says "hoje" and "ontem" for the last two days', () => {
    expect(versionStamp(saved, at(5))).toMatch(/^hoje \d{2}:\d{2}$/);
    expect(versionStamp(saved, at(6))).toMatch(/^ontem \d{2}:\d{2}$/);
  });

  it('gives the day and month, and the year only when it is another year', () => {
    expect(versionStamp(saved, at(20))).toMatch(/^05\/03 \d{2}:\d{2}$/);
    expect(versionStamp(saved, at(20, 2, 2027))).toMatch(/^05\/03\/2026 \d{2}:\d{2}$/);
  });

  it('returns the text as it came when it is not a date', () => {
    expect(versionStamp('sem data')).toBe('sem data');
  });
});

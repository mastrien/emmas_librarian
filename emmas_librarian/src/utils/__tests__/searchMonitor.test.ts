import { describe, expect, it } from 'vitest';
import {
  MONITOR_INTERVALS,
  MONITOR_MARGIN_DAYS,
  isMonitorDue,
  isMonitorResult,
  monitorResultQuery,
  monitorSinceDate,
} from '../searchMonitor';

const NOW = new Date('2026-11-15T12:00:00.000Z');

describe('isMonitorDue', () => {
  it('is due when never checked', () => {
    expect(isMonitorDue({ interval_days: 14, last_checked_at: null }, NOW)).toBe(true);
  });

  it('is due only once the interval passed', () => {
    expect(isMonitorDue({ interval_days: 7, last_checked_at: '2026-11-08T12:00:01.000Z' }, NOW)).toBe(false);
    expect(isMonitorDue({ interval_days: 7, last_checked_at: '2026-11-08T12:00:00.000Z' }, NOW)).toBe(true);
  });

  it('reads the date format of SQLite as UTC', () => {
    expect(isMonitorDue({ interval_days: 1, last_checked_at: '2026-11-14 12:00:00' }, NOW)).toBe(true);
    expect(isMonitorDue({ interval_days: 1, last_checked_at: '2026-11-14 12:00:01' }, NOW)).toBe(false);
  });
});

describe('monitorSinceDate', () => {
  it('looks back the margin from the last date, across months', () => {
    expect(monitorSinceDate('2026-11-01T10:00:00.000Z')).toBe('2026-10-02');
    expect(monitorSinceDate('2026-09-12 10:00:00')).toBe('2026-08-13');
  });

  it('keeps the margin above the longest interval, so no gap is left between checks', () => {
    expect(MONITOR_MARGIN_DAYS).toBeGreaterThan(Math.max(...MONITOR_INTERVALS));
  });
});

describe('what monitoring saved', () => {
  it('names the search it came from, and is told apart', () => {
    const query = monitorResultQuery(7, 'Título contém "x"');

    expect(query).toBe('Monitoramento da busca #7: Título contém "x"');
    expect(isMonitorResult({ unified_query: query })).toBe(true);
    expect(isMonitorResult({ unified_query: 'Título contém "x"' })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { homeTotals, readPercent, sharePercent, sortProjects } from '../homeNumbers';

const stats = (over: Partial<NonNullable<Parameters<typeof homeTotals>[0][number]['stats']>> = {}) => ({
  total: 10,
  read: 2,
  active: 6,
  archived: 2,
  withPdf: 4,
  diaryDates: ['2026-11-01'],
  ...over,
});

describe('homeNumbers', () => {
  it('sums the articles of every project and joins the diary days', () => {
    const totals = homeTotals([
      { stats: stats() },
      { stats: stats({ total: 5, withPdf: 1, diaryDates: ['2026-11-01', '2026-11-02'] }) },
      {},
    ]);

    expect(totals).toMatchObject({ total: 15, read: 4, active: 12, archived: 4, withPdf: 5, withoutPdf: 10 });
    expect([...totals.diaryDays]).toEqual(['2026-11-01', '2026-11-02']);
  });

  it('measures reading against the articles still in play, and shares against a total', () => {
    expect(readPercent({ active: 89, read: 7 })).toBe(7);
    expect(readPercent({ active: 0, read: 0 })).toBe(0);
    expect(sharePercent(17, 96)).toBe(18);
    expect(sharePercent(1, 0)).toBe(0);
  });

  it('orders the projects by the newest, or by name ignoring accents and case', () => {
    const projects = [
      { name: 'beta', created_at: '2026-01-02' },
      { name: 'Álvaro', created_at: '2026-01-01' },
      { name: 'Alfa', created_at: '2026-01-03' },
    ];

    expect(sortProjects(projects, 'recent').map((p) => p.name)).toEqual(['Alfa', 'beta', 'Álvaro']);
    expect(sortProjects(projects, 'az').map((p) => p.name)).toEqual(['Alfa', 'Álvaro', 'beta']);
  });
});

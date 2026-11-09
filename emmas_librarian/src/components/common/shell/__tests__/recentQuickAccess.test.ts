import { describe, it, expect } from 'vitest';
import { quickAccessSlots, recentQuickAccess } from '../recentQuickAccess';
import type { ProjectDocument } from '../../../../types';

const doc = (id: number, extra: Partial<ProjectDocument> = {}): ProjectDocument => ({
  id,
  project_id: 1,
  title: `Link ${id}`,
  url: `https://exemplo.org/${id}`,
  created_at: '2026-01-01',
  position: id,
  ...extra,
});

describe('recentQuickAccess', () => {
  it('puts the most recently opened links first', () => {
    const docs = [
      doc(1, { last_opened_at: '2026-11-01 10:00:00' }),
      doc(2, { last_opened_at: '2026-11-09 08:00:00' }),
      doc(3, { last_opened_at: '2026-11-05 12:00:00' }),
    ];

    expect(recentQuickAccess(docs, 3).map((d) => d.id)).toEqual([2, 3, 1]);
  });

  it('follows with never-opened links in their manual order', () => {
    const docs = [doc(1, { position: 2 }), doc(2, { position: 1 }), doc(3, { last_opened_at: '2026-11-01 10:00:00' })];

    expect(recentQuickAccess(docs, 3).map((d) => d.id)).toEqual([3, 2, 1]);
  });

  it('keeps only the limit and leaves the input untouched', () => {
    const docs = [doc(1), doc(2), doc(3)];

    expect(recentQuickAccess(docs, 2)).toHaveLength(2);
    expect(docs.map((d) => d.id)).toEqual([1, 2, 3]);
  });
});

describe('quickAccessSlots', () => {
  it('fills a third of the window with 28px rows after the heading and the "Ver todos" link', () => {
    expect(quickAccessSlots(800)).toBe(7);
    expect(quickAccessSlots(600)).toBe(5);
  });

  it('keeps at least 2 and at most 8 links', () => {
    expect(quickAccessSlots(300)).toBe(2);
    expect(quickAccessSlots(2000)).toBe(8);
  });
});

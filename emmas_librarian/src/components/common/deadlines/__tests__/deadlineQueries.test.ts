import { describe, it, expect } from 'vitest';
import type { ScientificMilestone, ScientificVenue } from '../../../../types';
import { deadlineBadge, upcomingDeadlines } from '../deadlineQueries';

const milestone = (extra: Partial<ScientificMilestone>): ScientificMilestone => ({
  label: 'Submissão',
  field_type: 'single',
  target_date: '2026-11-10',
  has_time: false,
  status: 'pending',
  ...extra,
});

const venue = (id: number, milestones: ScientificMilestone[]): ScientificVenue => ({
  id,
  title: `Evento ${id}`,
  category: 'conference',
  milestones,
});

describe('deadline queries (Arca 134)', () => {
  it('lists pending deadlines nearest first, overdue ones before them, up to the limit', () => {
    const venues = [
      venue(1, [milestone({ id: 1, target_date: '2026-11-20' }), milestone({ id: 2, target_date: '2026-11-01' })]),
      venue(2, [
        milestone({ id: 3, target_date: '2026-11-08' }),
        milestone({ id: 4, target_date: '2026-11-07', status: 'completed' }),
      ]),
    ];

    const items = upcomingDeadlines(venues, '2026-11-07', 2);

    expect(items.map((i) => [i.milestone.id, i.daysDiff])).toEqual([
      [2, -6],
      [3, 1],
    ]);
  });

  it('counts a range by its end date', () => {
    const range = milestone({ id: 5, field_type: 'range', target_date: '2026-11-01', end_date: '2026-11-09' });

    const [item] = upcomingDeadlines([venue(1, [range])], '2026-11-07', 4);

    expect([item.effectiveDate, item.daysDiff]).toEqual(['2026-11-09', 2]);
  });

  it.each([
    [0, 'today', 'Hoje!'],
    [-3, 'overdue', 'Venceu há 3 d'],
    [7, 'urgent', 'Em 7 dias'],
    [8, 'upcoming', 'Em 8 dias'],
  ])('labels %i days as %s', (days, tone, text) => {
    expect(deadlineBadge(days)).toEqual({ tone, text });
  });
});

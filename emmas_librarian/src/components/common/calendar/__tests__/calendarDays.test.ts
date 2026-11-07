import { describe, it, expect } from 'vitest';
import type { ScientificVenue } from '../../../../types';
import { dayTitle, deadlineColorsByDate, isoDay } from '../calendarDays';

const venue = (id: number, color: string | undefined, milestones: ScientificVenue['milestones']): ScientificVenue => ({
  id,
  title: `Evento ${id}`,
  category: 'conference',
  color,
  milestones,
});

describe('calendar days (Arca 134)', () => {
  it('gives each deadline date its venues colours once, a range on its start and end', () => {
    const venues = [
      venue(1, '#db2777', [
        { label: 'A', field_type: 'single', target_date: '2026-11-10', has_time: false, status: 'pending' },
        { label: 'B', field_type: 'single', target_date: '2026-11-10', has_time: false, status: 'completed' },
      ]),
      venue(2, undefined, [
        {
          label: 'C',
          field_type: 'range',
          target_date: '2026-11-10',
          end_date: '2026-11-12',
          has_time: false,
          status: 'pending',
        },
      ]),
    ];

    const colors = deadlineColorsByDate(venues);

    expect(colors.get('2026-11-10')).toEqual(['#db2777', 'var(--color-primary)']);
    expect(colors.get('2026-11-12')).toEqual(['var(--color-primary)']);
    expect(colors.has('2026-11-11')).toBe(false);
  });

  it('writes a day of a zero-based month as yyyy-mm-dd', () => {
    expect(isoDay(2026, 0, 5)).toBe('2026-01-05');
    expect(isoDay(2026, 10, 17)).toBe('2026-11-17');
  });

  it('names what a day holds in its tooltip', () => {
    const date = new Date(2026, 10, 7);

    expect(dayTitle(date, { diary: true, deadlines: 2, today: true })).toBe(
      `${date.toLocaleDateString()} • Atividade no Diário • 2 Prazo(s) • (Hoje)`,
    );
    expect(dayTitle(date, { diary: false, deadlines: 0, today: false })).toBe(date.toLocaleDateString());
  });
});

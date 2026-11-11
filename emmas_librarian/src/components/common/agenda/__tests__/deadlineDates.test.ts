import { describe, it, expect } from 'vitest';
import type { ScientificMilestone } from '../../../../types';
import {
  daysBetween,
  formatMilestoneDate,
  isStale,
  milestoneSituation,
  parseDay,
  situationText,
} from '../deadlineDates';

const milestone = (extra: Partial<ScientificMilestone>): ScientificMilestone => ({
  label: 'Evento',
  field_type: 'single',
  target_date: '2025-04-06',
  has_time: false,
  status: 'pending',
  ...extra,
});

const TODAY = new Date(2025, 10, 5, 15, 30);

describe('deadline dates (Arca 134, board 173)', () => {
  it('counts whole calendar days whatever the time of day', () => {
    expect(daysBetween(new Date(2025, 3, 6, 23, 59), new Date(2025, 3, 7, 0, 1))).toBe(1);
    expect(parseDay('2025-04-06').getDate()).toBe(6);
  });

  it('says a pending deadline is overdue, due today or ahead, and a done one is done', () => {
    expect(milestoneSituation(milestone({ target_date: '2025-04-06' }), TODAY)).toEqual({ kind: 'overdue', days: 213 });
    expect(milestoneSituation(milestone({ target_date: '2025-11-05' }), TODAY)).toEqual({ kind: 'today' });
    expect(milestoneSituation(milestone({ target_date: '2025-11-08' }), TODAY)).toEqual({ kind: 'upcoming', days: 3 });
    expect(milestoneSituation(milestone({ status: 'completed' }), TODAY)).toEqual({ kind: 'done' });
  });

  it('measures a range by its last day', () => {
    const range = milestone({ field_type: 'range', target_date: '2025-11-01', end_date: '2025-11-07' });
    expect(milestoneSituation(range, TODAY)).toEqual({ kind: 'upcoming', days: 2 });
  });

  it('writes the situation in short words', () => {
    expect(situationText({ kind: 'overdue', days: 213 })).toBe('venceu há 213 d');
    expect(situationText({ kind: 'upcoming', days: 3 })).toBe('em 3 d');
    expect(situationText({ kind: 'today' })).toBe('hoje');
    expect(situationText({ kind: 'done' })).toBe('feito');
  });

  it('calls stale only a pending deadline overdue by more than 60 days', () => {
    expect(isStale(milestone({ target_date: '2025-09-06' }), TODAY)).toBe(false); // 60 days: not yet
    expect(isStale(milestone({ target_date: '2025-09-05' }), TODAY)).toBe(true); // 61 days
    expect(isStale(milestone({ target_date: '2025-04-06', status: 'completed' }), TODAY)).toBe(false);
  });

  it('writes dates day first: single, with time, range in one month and across months', () => {
    expect(formatMilestoneDate(milestone({}))).toBe('06/04/2025');
    expect(formatMilestoneDate(milestone({ has_time: true, target_time: '23:59' }))).toBe('06/04/2025 às 23:59');
    const range = milestone({ field_type: 'range', end_date: '2025-04-09' });
    expect(formatMilestoneDate(range)).toBe('06 a 09/04/2025');
    expect(formatMilestoneDate({ ...range, end_date: '2025-05-02' })).toBe('06/04/2025 a 02/05/2025');
  });
});

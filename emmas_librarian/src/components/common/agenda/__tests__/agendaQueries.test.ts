import { describe, it, expect } from 'vitest';
import type { ScientificMilestone, ScientificVenue } from '../../../../types';
import { filterVenues, milestoneDateText, milestonesByDate, withMilestoneStatus } from '../agendaQueries';
import { venueColorVars } from '../venueColors';

const milestone = (extra: Partial<ScientificMilestone>): ScientificMilestone => ({
  label: 'Submissão',
  field_type: 'single',
  target_date: '2026-11-10',
  has_time: false,
  status: 'pending',
  ...extra,
});

const venue = (extra: Partial<ScientificVenue>): ScientificVenue => ({
  id: 1,
  title: 'Simpósio Brasileiro de Banco de Dados',
  acronym: 'SBBD',
  category: 'symposium',
  milestones: [],
  ...extra,
});

const VENUES = [
  venue({
    id: 1,
    milestones: [
      milestone({ id: 11, target_date: '2026-11-20' }),
      milestone({ id: 12, label: 'Inscrição', target_date: '2026-11-01', status: 'completed' }),
    ],
  }),
  venue({
    id: 2,
    title: 'Revista Brasileira de Meteorologia',
    acronym: 'RBMet',
    category: 'journal',
    milestones: [milestone({ id: 21, label: 'Chamada especial', target_date: '2026-11-05' })],
  }),
];

describe('agenda queries (Arca 134)', () => {
  it('filters by category and by a search in title, acronym or deadline name', () => {
    expect(filterVenues(VENUES, 'journal', '').map((v) => v.id)).toEqual([2]);
    expect(filterVenues(VENUES, 'all', 'sbbd').map((v) => v.id)).toEqual([1]);
    expect(filterVenues(VENUES, 'all', '  chamada ').map((v) => v.id)).toEqual([2]);
    expect(filterVenues(VENUES, 'symposium', 'meteorologia')).toEqual([]);
  });

  it('lists deadlines of the chosen status, earliest first, each with its venue', () => {
    const all = milestonesByDate(VENUES, 'all').map((x) => [x.milestone.id, x.venue.id]);
    expect(all).toEqual([
      [12, 1],
      [21, 2],
      [11, 1],
    ]);
    expect(milestonesByDate(VENUES, 'completed').map((x) => x.milestone.id)).toEqual([12]);
  });

  it('changes one deadline status without touching the others', () => {
    const next = withMilestoneStatus(VENUES, 11, 'completed');

    expect(next[0].milestones.map((m) => m.status)).toEqual(['completed', 'completed']);
    expect(next[1]).toEqual(VENUES[1]);
    expect(VENUES[0].milestones[0].status).toBe('pending');
  });

  it('writes a range, a date with time (two joins) or a plain date', () => {
    expect(milestoneDateText(milestone({ field_type: 'range', end_date: '2026-11-12' }), ' ')).toBe(
      '2026-11-10 a 2026-11-12',
    );
    const timed = milestone({ has_time: true, target_time: '14:00' });
    expect(milestoneDateText(timed, ' ')).toBe('2026-11-10 14:00');
    expect(milestoneDateText(timed, ' às ')).toBe('2026-11-10 às 14:00');
    expect(milestoneDateText(milestone({ has_time: true }), ' às ')).toBe('2026-11-10');
  });

  it('passes a venue colour and its tint as CSS variables, nothing without a colour', () => {
    expect(venueColorVars({ color: '#db2777' })).toEqual({ '--venue-color': '#db2777', '--venue-tint': '#db277722' });
    expect(venueColorVars({})).toBeUndefined();
  });
});

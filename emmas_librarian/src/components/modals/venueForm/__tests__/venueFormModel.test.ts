import { describe, it, expect } from 'vitest';
import {
  EMPTY_VENUE_DETAILS,
  defaultMilestones,
  milestonesForEditing,
  newCustomMilestone,
  toVenuePayload,
  venueDetailsOf,
  venueValidationError,
} from '../venueFormModel';
import type { ScientificMilestone, ScientificVenue } from '../../../../types';

const single = (overrides: Partial<ScientificMilestone> = {}): ScientificMilestone => ({
  label: 'S',
  field_type: 'single',
  target_date: '2026-01-10',
  has_time: false,
  status: 'pending',
  ...overrides,
});

const range = (overrides: Partial<ScientificMilestone> = {}) =>
  single({ label: 'R', field_type: 'range', end_date: '2026-01-20', ...overrides });

const details = { ...EMPTY_VENUE_DETAILS, title: 'Venue' };

describe('venueDetailsOf', () => {
  it('fills missing optional fields with defaults', () => {
    expect(venueDetailsOf({ id: 1, title: 'T' } as ScientificVenue)).toEqual({ ...EMPTY_VENUE_DETAILS, title: 'T' });
  });

  it('keeps the provided fields', () => {
    const venue = { id: 1, title: 'T', acronym: 'A', category: 'journal', url: 'u', color: '#fff' } as ScientificVenue;

    expect(venueDetailsOf(venue)).toEqual({ title: 'T', acronym: 'A', category: 'journal', url: 'u', color: '#fff' });
  });
});

describe('defaultMilestones', () => {
  it('creates registration, a submission range and presentation on the given date', () => {
    const milestones = defaultMilestones('2026-02-02');

    expect(milestones.map((m) => [m.label, m.field_type, m.target_date])).toEqual([
      ['Inscrição', 'single', '2026-02-02'],
      ['Submissão', 'range', '2026-02-02'],
      ['Apresentação', 'single', '2026-02-02'],
    ]);
  });
});

describe('milestonesForEditing', () => {
  it('turns null end dates and times into empty strings', () => {
    const venue = {
      milestones: [single({ end_date: null as unknown as string, target_time: undefined })],
    } as ScientificVenue;

    expect(milestonesForEditing(venue)[0]).toMatchObject({ end_date: '', target_time: '' });
  });

  it('returns an empty list for a venue without milestones', () => {
    expect(milestonesForEditing({} as ScientificVenue)).toEqual([]);
  });
});

describe('newCustomMilestone', () => {
  it('starts a range on the same start and end date', () => {
    expect(newCustomMilestone('X', 'range', '2026-03-03')).toMatchObject({
      target_date: '2026-03-03',
      end_date: '2026-03-03',
    });
  });

  it('leaves a single milestone without an end date', () => {
    expect(newCustomMilestone('X', 'single', '2026-03-03').end_date).toBe('');
  });
});

describe('venueValidationError', () => {
  it('requires a title', () => {
    expect(venueValidationError({ ...details, title: ' ' }, [single()])).toBe(
      'O título do evento/periódico é obrigatório.',
    );
  });

  it('requires at least one milestone with label and date', () => {
    expect(venueValidationError(details, [single({ label: ' ' }), single({ target_date: '' })])).toBe(
      'Adicione e preencha pelo menos um prazo válido para o evento.',
    );
  });

  it('rejects a range that ends before it starts', () => {
    expect(venueValidationError(details, [single(), range({ label: 'Rev', end_date: '2026-01-01' })])).toBe(
      'No prazo "Rev", a data final não pode ser anterior à data inicial.',
    );
  });

  it('ignores inverted ranges on unfilled milestones and accepts open-ended ranges', () => {
    expect(
      venueValidationError(details, [range({ end_date: '' }), range({ label: '', end_date: '2000-01-01' })]),
    ).toBeNull();
  });
});

describe('toVenuePayload', () => {
  it('trims text and drops blank optionals', () => {
    const payload = toVenuePayload({ ...details, title: ' T ', acronym: ' ', url: ' ' }, [single()]);

    expect(payload).toMatchObject({ title: 'T', acronym: undefined, url: undefined, category: 'conference' });
  });

  it('keeps only filled milestones, normalizing end dates and times by type', () => {
    const payload = toVenuePayload(details, [
      single({ has_time: true, target_time: '10:00', end_date: 'x' }),
      single({ has_time: false, target_time: '11:00' }),
      range({ has_time: true, target_time: '12:00' }),
      range({ end_date: '' }),
      single({ label: '' }),
    ]);

    expect(payload.milestones!.map((m) => [m.end_date, m.has_time, m.target_time])).toEqual([
      [undefined, true, '10:00'],
      [undefined, false, undefined],
      ['2026-01-20', false, undefined],
      [undefined, false, undefined],
    ]);
  });
});

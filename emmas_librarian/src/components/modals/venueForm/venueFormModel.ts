import type { ScientificVenue, ScientificMilestone, VenueCategory, MilestoneFieldType } from '../../../types';

export type VenuePayload = Omit<ScientificVenue, 'id' | 'created_at'>;

/** The venue's own fields as edited in the form (milestones are kept separately). */
export interface VenueDetails {
  title: string;
  acronym: string;
  category: VenueCategory;
  url: string;
  color: string;
}

export const CATEGORY_OPTIONS: ReadonlyArray<{ value: VenueCategory; label: string }> = [
  { value: 'conference', label: 'Congresso / Conferência' },
  { value: 'journal', label: 'Periódico / Revista' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'symposium', label: 'Simpósio' },
  { value: 'other', label: 'Outro Evento' },
];

export const PRESET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const EMPTY_VENUE_DETAILS: VenueDetails = {
  title: '',
  acronym: '',
  category: 'conference',
  url: '',
  color: PRESET_COLORS[0],
};

/** Today as YYYY-MM-DD (UTC), the fallback date for new milestones. */
export const todayIso = (): string => new Date().toISOString().split('T')[0];

/**
 * The form values for an existing venue.
 *
 * Usage:
 *   setDetails(venueDetailsOf(venue));
 */
export function venueDetailsOf(venue: ScientificVenue): VenueDetails {
  return {
    title: venue.title,
    acronym: venue.acronym || '',
    category: venue.category || EMPTY_VENUE_DETAILS.category,
    url: venue.url || '',
    color: venue.color || EMPTY_VENUE_DETAILS.color,
  };
}

/**
 * Registration, submission (a range) and presentation, all starting on `date`: the usual shape of a call.
 *
 * Usage:
 *   setMilestones(defaultMilestones('2026-09-15'));
 */
export function defaultMilestones(date: string): ScientificMilestone[] {
  return [
    { label: 'Inscrição', field_type: 'single', target_date: date, has_time: false, status: 'pending' },
    { label: 'Submissão', field_type: 'range', target_date: date, end_date: '', has_time: false, status: 'pending' },
    { label: 'Apresentação', field_type: 'single', target_date: date, has_time: false, status: 'pending' },
  ];
}

/**
 * A venue's milestones with null optional fields turned into '' so the inputs stay controlled.
 *
 * Usage:
 *   setMilestones(milestonesForEditing(venue));
 */
export function milestonesForEditing(venue: ScientificVenue): ScientificMilestone[] {
  return (venue.milestones || []).map((m) => ({ ...m, end_date: m.end_date || '', target_time: m.target_time || '' }));
}

/**
 * A pending custom milestone on `date`; ranges start and end on the same day.
 *
 * Usage:
 *   newCustomMilestone('Camera ready', 'single', '2026-09-15');
 */
export function newCustomMilestone(label: string, type: MilestoneFieldType, date: string): ScientificMilestone {
  return {
    label,
    field_type: type,
    target_date: date,
    end_date: type === 'range' ? date : '',
    has_time: false,
    status: 'pending',
  };
}

const isFilled = (m: ScientificMilestone) => Boolean(m.label.trim() && m.target_date.trim());

const invertedRange = (m: ScientificMilestone) =>
  m.field_type === 'range' && !!m.end_date && m.end_date < m.target_date;

/**
 * The first reason the form cannot be saved, or null. Milestones without a label or date are ignored.
 *
 * Usage:
 *   const error = venueValidationError(details, milestones);
 */
export function venueValidationError(details: VenueDetails, milestones: ScientificMilestone[]): string | null {
  if (!details.title.trim()) return 'O título do evento/periódico é obrigatório.';
  const filled = milestones.filter(isFilled);
  if (filled.length === 0) return 'Adicione e preencha pelo menos um prazo válido para o evento.';
  const inverted = filled.find(invertedRange);
  if (inverted) return `No prazo "${inverted.label}", a data final não pode ser anterior à data inicial.`;
  return null;
}

// Only ranges keep an end date and only timed single milestones keep a time.
const normalizedMilestone = (m: ScientificMilestone): ScientificMilestone => ({
  ...m,
  end_date: m.field_type === 'range' && m.end_date ? m.end_date : undefined,
  has_time: m.field_type === 'single' ? m.has_time : false,
  target_time: m.field_type === 'single' && m.has_time ? m.target_time : undefined,
});

/**
 * The venue to save: trimmed text, blank optionals dropped, unfilled milestones removed.
 *
 * Usage:
 *   onSave(toVenuePayload(details, milestones));
 */
export function toVenuePayload(details: VenueDetails, milestones: ScientificMilestone[]): VenuePayload {
  return {
    title: details.title.trim(),
    acronym: details.acronym.trim() || undefined,
    category: details.category,
    url: details.url.trim() || undefined,
    color: details.color,
    milestones: milestones.filter(isFilled).map(normalizedMilestone),
  };
}

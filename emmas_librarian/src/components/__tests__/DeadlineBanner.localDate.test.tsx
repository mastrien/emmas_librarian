import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeadlineBanner } from '../common/DeadlineBanner';
import { ScientificVenue } from '../../types';

const venueDueOn = (date: string): ScientificVenue => ({
  id: 1,
  title: 'Simpósio de Banco de Dados',
  acronym: 'SBBD 2026',
  category: 'conference',
  color: '#3b82f6',
  milestones: [
    {
      id: 101,
      venue_id: 1,
      label: 'Submissão',
      field_type: 'single',
      target_date: date,
      has_time: false,
      status: 'pending',
    },
  ],
});

describe('DeadlineBanner day count in the user time zone', () => {
  const originalTz = process.env.TZ;

  // After 21:00 in Brazil (UTC-3) the UTC date is already the next day.
  beforeEach(() => {
    process.env.TZ = 'America/Sao_Paulo';
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 26, 22, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTz;
  });

  it('shows "Hoje!" for a deadline on the local date late in the evening', () => {
    render(
      <DeadlineBanner venues={[venueDueOn('2026-09-26')]} onToggleMilestoneStatus={vi.fn()} onOpenAgenda={vi.fn()} />,
    );

    expect(screen.getByText('Hoje!')).toBeInTheDocument();
  });

  it('counts tomorrow as one day away late in the evening', () => {
    render(
      <DeadlineBanner venues={[venueDueOn('2026-09-27')]} onToggleMilestoneStatus={vi.fn()} onOpenAgenda={vi.fn()} />,
    );

    expect(screen.getByText('Em 1 dias')).toBeInTheDocument();
  });
});

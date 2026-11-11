import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DeadlineBanner, deadlineSubline } from '../common/deadlines/DeadlineBanner';
import type { DeadlineItem } from '../common/deadlines/deadlineQueries';
import { ScientificVenue } from '../../types';

const MOCK_VENUES: ScientificVenue[] = [
  {
    id: 1,
    title: 'Simpósio de Banco de Dados',
    acronym: 'SBBD 2026',
    category: 'conference',
    color: '#3b82f6',
    milestones: [
      {
        id: 101,
        venue_id: 1,
        label: 'Chamada de Trabalhos',
        field_type: 'range',
        target_date: '2026-01-01',
        end_date: '2026-12-31', // range ends in Dec 31
        has_time: false,
        status: 'pending',
      },
    ],
  },
];

describe('DeadlineBanner (TDD)', () => {
  const mockOnToggleStatus = vi.fn();
  const mockOnOpenAgenda = vi.fn();

  it('calculates deadline based on end_date for range milestones', () => {
    render(
      <DeadlineBanner
        venues={MOCK_VENUES}
        onToggleMilestoneStatus={mockOnToggleStatus}
        onOpenAgenda={mockOnOpenAgenda}
      />,
    );

    expect(screen.getByText('Chamada de Trabalhos')).toBeInTheDocument();
    expect(screen.getByText('SBBD 2026 · 2026-01-01 a 2026-12-31')).toBeInTheDocument();
  });

  it('triggers onToggleMilestoneStatus when checkbox is clicked', () => {
    render(
      <DeadlineBanner
        venues={MOCK_VENUES}
        onToggleMilestoneStatus={mockOnToggleStatus}
        onOpenAgenda={mockOnOpenAgenda}
      />,
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(mockOnToggleStatus).toHaveBeenCalledWith(101, 'completed');
  });
});

describe('deadlineSubline', () => {
  const item = (venue: Partial<ScientificVenue>, end_date?: string): DeadlineItem => ({
    venue: { ...MOCK_VENUES[0], ...venue },
    milestone: { ...MOCK_VENUES[0].milestones![0], end_date },
    effectiveDate: end_date ?? '2026-01-01',
    daysDiff: 3,
  });

  it('names the event by its acronym and adds the dates of a range', () => {
    expect(deadlineSubline(item({}, '2026-12-31'))).toBe('SBBD 2026 · 2026-01-01 a 2026-12-31');
  });

  it('falls back to the title of an event with no acronym, with no dates for a single day', () => {
    expect(deadlineSubline(item({ acronym: '', title: 'Revista Brasileira de Meteorologia' }))).toBe(
      'Revista Brasileira de Meteorologia',
    );
  });
});

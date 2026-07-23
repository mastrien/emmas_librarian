import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DeadlineBanner } from '../common/DeadlineBanner';
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
    expect(screen.getByText(/2026-01-01 a 2026-12-31/i)).toBeInTheDocument();
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

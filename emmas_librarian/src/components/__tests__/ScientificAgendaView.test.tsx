import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScientificAgendaView } from '../common/ScientificAgendaView';
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
        label: 'Submissão de Artigo',
        field_type: 'range',
        target_date: '2026-08-01',
        end_date: '2026-08-15',
        has_time: false,
        status: 'pending',
      },
    ],
  },
  {
    id: 2,
    title: 'Revista de Engenharia de Software',
    acronym: 'RES',
    category: 'journal',
    color: '#10b981',
    milestones: [
      {
        id: 102,
        venue_id: 2,
        label: 'Submissão Inicial',
        field_type: 'single',
        target_date: '2026-09-01',
        has_time: true,
        target_time: '23:59',
        status: 'completed',
      },
    ],
  },
];

describe('ScientificAgendaView (TDD)', () => {
  const mockOnAddVenue = vi.fn();
  const mockOnEditVenue = vi.fn();
  const mockOnDeleteVenue = vi.fn();
  const mockOnToggleMilestoneStatus = vi.fn().mockResolvedValue(true);

  it('renders venue cards by default and handles text search filter', () => {
    render(
      <ScientificAgendaView
        venues={MOCK_VENUES}
        diarySet={new Set()}
        onAddVenue={mockOnAddVenue}
        onEditVenue={mockOnEditVenue}
        onDeleteVenue={mockOnDeleteVenue}
        onToggleMilestoneStatus={mockOnToggleMilestoneStatus}
      />,
    );

    expect(screen.getByText(/SBBD 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/RES — Revista/i)).toBeInTheDocument();

    // Filter text
    const searchInput = screen.getByPlaceholderText(/Buscar por evento ou sigla.../i);
    fireEvent.change(searchInput, { target: { value: 'Engenharia' } });

    expect(screen.queryByText(/SBBD 2026/i)).not.toBeInTheDocument();
    expect(screen.getByText(/RES — Revista/i)).toBeInTheDocument();
  });

  it('switches to milestone_list mode using the unified pill control', () => {
    render(
      <ScientificAgendaView
        venues={MOCK_VENUES}
        diarySet={new Set()}
        onAddVenue={mockOnAddVenue}
        onEditVenue={mockOnEditVenue}
        onDeleteVenue={mockOnDeleteVenue}
        onToggleMilestoneStatus={mockOnToggleMilestoneStatus}
      />,
    );

    const listBtn = screen.getByText('Lista de Prazos');
    fireEvent.click(listBtn);

    expect(screen.getByText('Submissão de Artigo')).toBeInTheDocument();
    expect(screen.getByText('Submissão Inicial')).toBeInTheDocument();
  });

  it('performs optimistic local status update when milestone status is toggled', async () => {
    render(
      <ScientificAgendaView
        venues={MOCK_VENUES}
        diarySet={new Set()}
        onAddVenue={mockOnAddVenue}
        onEditVenue={mockOnEditVenue}
        onDeleteVenue={mockOnDeleteVenue}
        onToggleMilestoneStatus={mockOnToggleMilestoneStatus}
      />,
    );

    const toggleBtns = screen.getAllByRole('checkbox');
    fireEvent.click(toggleBtns[0]);

    expect(mockOnToggleMilestoneStatus).toHaveBeenCalledWith(101, 'completed');
  });
});

import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const OLD_VENUE: ScientificVenue = {
  id: 3,
  title: 'Revista Brasileira de Meteorologia',
  acronym: 'RBMet',
  category: 'journal',
  milestones: [
    {
      id: 103,
      venue_id: 3,
      label: 'Chamada especial',
      field_type: 'single',
      target_date: '2026-02-01',
      has_time: false,
      status: 'pending',
    },
  ],
};

describe('ScientificAgendaView (boards 172 and 173)', () => {
  const mockOnAddVenue = vi.fn();
  const mockOnToggleMilestoneStatus = vi.fn().mockResolvedValue(true);

  // Today is 20 July 2026: the August deadline is ahead, the February one is long overdue.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 20, 10, 0));
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  const renderView = (venues = MOCK_VENUES) =>
    render(
      <ScientificAgendaView
        venues={venues}
        onAddVenue={mockOnAddVenue}
        onEditVenue={vi.fn()}
        onDeleteVenue={vi.fn()}
        onToggleMilestoneStatus={mockOnToggleMilestoneStatus}
      />,
    );

  const openList = () => fireEvent.click(screen.getByRole('button', { name: 'Lista de prazos' }));

  it('opens on the current month with the events panel, and searches by event or acronym', () => {
    renderView();

    expect(screen.getByText('Julho de 2026')).toBeInTheDocument();
    const panel = screen.getByRole('complementary', { name: 'Eventos e revistas' });
    expect(within(panel).getByText('SBBD 2026 · Simpósio de Banco de Dados')).toBeInTheDocument();
    expect(within(panel).getByText('RES · Revista de Engenharia de Software')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Evento ou sigla'), { target: { value: 'Engenharia' } });

    expect(within(panel).queryByText(/SBBD 2026/)).not.toBeInTheDocument();
    expect(within(panel).getByText(/RES ·/)).toBeInTheDocument();
  });

  it('moves between months, draws a chip on each day of a range and returns with "Hoje"', () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    const grid = screen.getByTestId('month-grid');
    expect(screen.getByText('Agosto de 2026')).toBeInTheDocument();
    expect(within(grid).getByText('SBBD 2026 · Submissão de Artigo')).toBeInTheDocument();
    expect(within(grid).getAllByText('SBBD 2026')).toHaveLength(14); // the other days of the range

    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(screen.getByText('Julho de 2026')).toBeInTheDocument();
  });

  it('starts a new event on the clicked day', () => {
    renderView();

    fireEvent.click(within(screen.getByTestId('month-grid')).getByTitle('20/07/2026'));

    expect(mockOnAddVenue).toHaveBeenCalledWith('2026-07-20');
  });

  it('lists the pending deadlines first, with counts, and the done ones on request', () => {
    renderView();
    openList();

    expect(screen.getByRole('button', { name: 'Pendentes 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Submissão de Artigo')).toBeInTheDocument();
    expect(screen.getByText('em 26 d')).toBeInTheDocument();
    expect(screen.queryByText('Submissão Inicial')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Feitos 1' }));

    expect(screen.getByText('Submissão Inicial')).toBeInTheDocument();
    expect(screen.getByText('feito')).toBeInTheDocument();
    expect(screen.queryByText('Submissão de Artigo')).not.toBeInTheDocument();
  });

  it('groups the list by month', () => {
    renderView();
    openList();
    fireEvent.click(screen.getByRole('button', { name: 'Todos 2' }));

    expect(screen.getByRole('columnheader', { name: 'Agosto de 2026' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Setembro de 2026' })).toBeInTheDocument();
  });

  it('warns about a deadline overdue for long, can hide it from the list and marks it done', () => {
    renderView([...MOCK_VENUES, OLD_VENUE]);
    openList();

    expect(screen.getByText('venceu há 169 d')).toBeInTheDocument();
    expect(screen.getByText('Um prazo venceu há mais de 60 dias')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: /Mostrar vencidos há mais de 60 dias/ }));
    expect(screen.queryByText('venceu há 169 d')).not.toBeInTheDocument();
    expect(screen.getByText('Um prazo venceu há mais de 60 dias')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como feito' }));

    expect(mockOnToggleMilestoneStatus).toHaveBeenCalledWith(103, 'completed');
    expect(screen.queryByText(/venceu há mais de 60 dias/)).not.toBeInTheDocument();
  });

  it('marks a deadline done at once from the panel, before the save returns', async () => {
    renderView();

    const checkbox = screen.getAllByRole('checkbox')[0];
    await act(async () => {
      fireEvent.click(checkbox);
    });

    expect(mockOnToggleMilestoneStatus).toHaveBeenCalledWith(101, 'completed');
    expect(checkbox).toBeChecked();
  });
});

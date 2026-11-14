import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VenueCard } from '../VenueCard';
import type { ScientificVenue } from '../../../../types';

const VENUE = {
  id: 7,
  title: 'Simpósio Brasileiro de Sensoriamento Remoto',
  acronym: 'SBSR',
  category: 'symposium',
  url: 'https://sbsr.example.org',
  color: '#ec4899',
  milestones: [],
} as unknown as ScientificVenue;

function renderCard(handlers = { onEdit: vi.fn(), onDelete: vi.fn() }) {
  render(<VenueCard venue={VENUE} today={new Date(2026, 10, 13)} onToggle={vi.fn()} {...handlers} />);
  return handlers;
}

describe('VenueCard actions (board 172)', () => {
  it('keeps the link to the event beside a "…" menu, instead of loose pencil and bin icons', () => {
    renderCard();

    expect(screen.getByTitle('Abrir URL do Evento')).toHaveAttribute('href', 'https://sbsr.example.org');
    expect(screen.getByRole('button', { name: 'Ações de SBSR' })).toBeInTheDocument();
    expect(screen.queryByTitle('Editar Evento')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Excluir Evento')).not.toBeInTheDocument();
  });

  it('edits the event from the menu', () => {
    const { onEdit, onDelete } = renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Ações de SBSR' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar evento' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('asks to delete the event from the menu', () => {
    const { onEdit, onDelete } = renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Ações de SBSR' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir evento' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('names the menu by the title when the event has no acronym', () => {
    render(
      <VenueCard
        venue={{ ...VENUE, acronym: '' } as ScientificVenue}
        today={new Date(2026, 10, 13)}
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: `Ações de ${VENUE.title}` })).toBeInTheDocument();
  });
});

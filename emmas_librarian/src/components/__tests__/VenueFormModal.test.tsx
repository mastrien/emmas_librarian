import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VenueFormModal } from '../modals/VenueFormModal';

describe('VenueFormModal (TDD)', () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  it('renders modal in portal and displays predefined milestones', () => {
    render(
      <VenueFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    expect(screen.getByText('Novo Evento / Periódico')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Inscrição')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Submissão')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Apresentação')).toBeInTheDocument();
  });

  it('validates that end_date cannot be before target_date for range milestones', async () => {
    render(
      <VenueFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Simpósio Brasileiro de BD/i), {
      target: { value: 'Conferência de IA' },
    });

    const addCustomBtn = screen.getByText('+ Criar Novo Campo');
    fireEvent.click(addCustomBtn);

    const labelInput = screen.getByPlaceholderText(/Ex: Avaliação de Pares/i);
    fireEvent.change(labelInput, { target: { value: 'Período de Revisão' } });

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]); // 2nd radio is "Intervalo"

    const confirmFieldBtn = screen.getByText('Confirmar Campo');
    fireEvent.click(confirmFieldBtn);

    // Get all date inputs rendered in the modal
    const allDateInputs = screen.getAllByDisplayValue((val) => typeof val === 'string').filter((i) => i.getAttribute('type') === 'date');
    const targetDateInput = allDateInputs[allDateInputs.length - 2];
    const endDateInput = allDateInputs[allDateInputs.length - 1];

    fireEvent.change(targetDateInput, { target: { value: '2026-08-10' } });
    fireEvent.change(endDateInput, { target: { value: '2026-08-05' } });

    const saveBtn = screen.getByText('Salvar Evento');
    fireEvent.click(saveBtn);

    // Modal should not call onSave because end_date (2026-08-05) < target_date (2026-08-10)
    expect(mockOnSave).not.toHaveBeenCalled();
    expect(screen.getByText(/a data final não pode ser anterior à data inicial/i)).toBeInTheDocument();
  });

  it('allows adding a custom field inline without prompt()', () => {
    render(
      <VenueFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    fireEvent.click(screen.getByText('+ Criar Novo Campo'));

    const labelInput = screen.getByPlaceholderText(/Ex: Avaliação de Pares/i);
    fireEvent.change(labelInput, { target: { value: 'Revisão Final' } });

    fireEvent.click(screen.getByText('Confirmar Campo'));

    expect(screen.getByDisplayValue('Revisão Final')).toBeInTheDocument();
  });

  it('successfully calls onSave when valid data is submitted', async () => {
    render(
      <VenueFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        initialDate="2026-09-15"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Simpósio Brasileiro de BD/i), {
      target: { value: 'Simpósio Teste' },
    });

    fireEvent.click(screen.getByText('Salvar Evento'));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Simpósio Teste',
          milestones: expect.arrayContaining([
            expect.objectContaining({
              label: 'Inscrição',
              target_date: '2026-09-15',
            }),
          ]),
        }),
      );
    });
  });
});

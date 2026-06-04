import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ArchiveModal } from '../modals/ArchiveModal';

describe('ArchiveModal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ArchiveModal isOpen={false} onClose={vi.fn()} onSubmit={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders correctly and allows submitting the form', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    render(
      <ArchiveModal isOpen={true} onClose={onClose} onSubmit={onSubmit} />
    );

    expect(screen.getByText('Motivo do Arquivamento (Opcional)')).toBeInTheDocument();
    
    const textarea = screen.getByPlaceholderText('Por que este artigo não é relevante?');
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'Out of scope' } });
    
    const submitBtn = screen.getByText('Confirmar Arquivamento');
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith('Out of scope');
  });

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    render(
      <ArchiveModal isOpen={true} onClose={onClose} onSubmit={onSubmit} />
    );

    const cancelBtn = screen.getByText('Cancelar');
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalled();
  });
});

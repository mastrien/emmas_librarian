import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuotaModal } from '../modals/QuotaModal';

describe('QuotaModal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(<QuotaModal isOpen={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders correctly and handles close action', () => {
    const onClose = vi.fn();
    render(<QuotaModal isOpen={true} onClose={onClose} />);

    expect(screen.getByText('Limite de Cota Atingido')).toBeInTheDocument();
    expect(screen.getByText(/A sua chave de API/)).toBeInTheDocument();

    const btn = screen.getByText('Entendi');
    fireEvent.click(btn);

    expect(onClose).toHaveBeenCalled();
  });

  it('puts a red icon beside the title instead of a large one above the text (board 179)', () => {
    render(<QuotaModal isOpen={true} onClose={vi.fn()} />);

    expect(document.querySelector('.app-modal-icon.is-danger')).not.toBeNull();
  });
});

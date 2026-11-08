import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyRequiredModal } from '../KeyRequiredModal';

describe('KeyRequiredModal', () => {
  it('shows the reason and wires cancel, the X and the settings button', () => {
    const onCancel = vi.fn();
    const onOpenSettings = vi.fn();
    render(
      <KeyRequiredModal title="Chave X" onCancel={onCancel} onOpenSettings={onOpenSettings}>
        Precisa da chave.
      </KeyRequiredModal>,
    );
    expect(screen.getByRole('dialog', { name: 'Chave X' })).toBeInTheDocument();
    expect(screen.getByText('Precisa da chave.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancelar'));
    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(onCancel).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText('Configurações'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});

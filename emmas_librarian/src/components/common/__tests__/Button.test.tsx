import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button, buttonClassName } from '../Button';

describe('Button (Arca 134)', () => {
  it('is secondary, normal size and its own width by default', () => {
    expect(buttonClassName()).toBe('btn-secondary');
  });

  it('maps variant, size and fill to the btn classes', () => {
    expect(buttonClassName({ variant: 'primary', size: 'sm', fill: 'grow' })).toBe('btn-primary btn--sm btn--grow');
    expect(buttonClassName({ variant: 'danger', fill: 'block' })).toBe('btn-danger btn--block');
    expect(buttonClassName({ variant: 'ghost' })).toBe('btn-ghost');
  });

  it('does not submit the form it sits in unless asked to', () => {
    const submit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={submit}>
        <Button>Cancelar</Button>
        <Button type="submit" variant="primary">
          Salvar
        </Button>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('keeps extra classes and passes the rest to the button', () => {
    render(
      <Button variant="ghost" className="row-action" aria-label="Excluir" disabled>
        x
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Excluir' });
    expect(button.className).toBe('btn-ghost row-action');
    expect(button).toBeDisabled();
  });
});

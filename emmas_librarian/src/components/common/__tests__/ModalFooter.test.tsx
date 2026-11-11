import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModalFooter } from '../ModalFooter';

describe('ModalFooter', () => {
  it('shows the hint at the left and the buttons at the right', () => {
    render(
      <ModalFooter hint="Ctrl Enter salva">
        <button type="button">Cancelar</button>
        <button type="button">Salvar</button>
      </ModalFooter>,
    );

    expect(screen.getByText('Ctrl Enter salva')).toHaveClass('app-modal-foot__hint');
    expect(screen.getByRole('button', { name: 'Salvar' }).parentElement).toHaveClass('app-modal-foot__actions');
  });

  it('has no hint element when none is given', () => {
    const { container } = render(
      <ModalFooter>
        <button type="button">OK</button>
      </ModalFooter>,
    );

    expect(container.querySelector('.app-modal-foot__hint')).toBeNull();
  });

  it('drops the tinted background only when asked to be plain', () => {
    const { container, rerender } = render(<ModalFooter>x</ModalFooter>);
    expect(container.firstChild).not.toHaveClass('is-plain');

    rerender(<ModalFooter plain>x</ModalFooter>);

    expect(container.firstChild).toHaveClass('is-plain');
  });

  it('keeps a leading button at the left, before the hint and the main buttons', () => {
    render(
      <ModalFooter leading={<button type="button">Descartar</button>} hint="dica">
        <button type="button">Salvar</button>
      </ModalFooter>,
    );

    const order = Array.from(document.querySelector('.app-modal-foot')!.children).map((el) => el.textContent);
    expect(order).toEqual(['Descartar', 'dica', 'Salvar']);
  });
});

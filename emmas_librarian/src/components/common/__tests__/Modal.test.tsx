import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '../Modal';

const open = (extra: Partial<React.ComponentProps<typeof Modal>> = {}) => {
  const onClose = vi.fn();
  render(
    <div className="fade-in" data-testid="page">
      <Modal label="Janela" title="Título" description="Explicação" onClose={onClose} {...extra}>
        <p>conteúdo</p>
      </Modal>
    </div>,
  );
  return onClose;
};

describe('Modal', () => {
  // A transformed or scrolling ancestor would make the backdrop cover only part of the screen.
  it('leaves the page for the body, with the backdrop around the window', () => {
    open();

    const overlay = screen.getByTestId('app-modal-overlay');
    expect(overlay.parentElement).toBe(document.body);
    expect(screen.getByTestId('page')).not.toContainElement(overlay);
    expect(overlay).toContainElement(screen.getByRole('dialog', { name: 'Janela' }));
  });

  it('takes its styles from names no page uses, plus the classes it is given', () => {
    open({ className: 'review-modal' });

    expect(screen.getByTestId('app-modal-overlay')).toHaveClass('app-modal-overlay');
    expect(screen.getByTestId('app-modal-overlay')).not.toHaveClass('review-modal');
    expect(screen.getByRole('dialog')).toHaveClass('app-modal', 'review-modal');
  });

  it('shows its title, explanation and content', () => {
    open();

    expect(screen.getByRole('heading', { name: 'Título' })).toBeInTheDocument();
    expect(screen.getByText('Explicação')).toBeInTheDocument();
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('closes with its X, named as asked', () => {
    const onClose = open({ closeLabel: 'Fechar sem salvar' });

    fireEvent.click(screen.getByRole('button', { name: 'Fechar sem salvar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes with Esc', () => {
    const onClose = open();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Esc when asked to, and still closes with its X', () => {
    const onClose = open({ closeOnEscape: false });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cannot be closed while something runs', () => {
    const onClose = open({ busy: true });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('never passes the screen, however wide it is asked to be', () => {
    open({ width: 900 });

    expect(screen.getByRole('dialog').style).toMatchObject({ width: '900px', maxWidth: '100%' });
  });

  it('puts an icon in a tinted square before the title, in the tone it is given', () => {
    open({ icon: <svg data-testid="bin" />, tone: 'danger' });

    const square = screen.getByTestId('bin').parentElement;
    expect(square).toHaveClass('app-modal-icon', 'is-danger');
  });

  it('shows no icon square when none is given', () => {
    open();

    expect(document.querySelector('.app-modal-icon')).toBeNull();
  });
});

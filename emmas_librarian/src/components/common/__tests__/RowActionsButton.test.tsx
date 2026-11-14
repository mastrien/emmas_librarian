import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RowActionsButton } from '../RowActionsButton';

const renderButton = () => {
  const edit = vi.fn();
  const remove = vi.fn();
  render(
    <RowActionsButton
      label="Ações de Período"
      items={[
        { label: 'Editar', icon: null, onSelect: edit },
        { label: 'Excluir', icon: null, onSelect: remove, danger: true },
      ]}
    />,
  );
  return { edit, remove };
};

describe('RowActionsButton', () => {
  it('opens a menu with the actions and runs the chosen one', () => {
    const { edit, remove } = renderButton();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ações de Período' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));

    expect(edit).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('says whether the menu is open and closes with Esc', () => {
    renderButton();
    const button = screen.getByRole('button', { name: 'Ações de Período' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows no heading above the actions', () => {
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Ações de Período' }));

    expect(document.querySelector('.row-menu__label')).toBeNull();
  });
});

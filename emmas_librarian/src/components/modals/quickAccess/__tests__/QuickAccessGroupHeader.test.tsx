import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QuickAccessGroupHeader } from '../QuickAccessGroupHeader';

const renderHeader = () => {
  const onRename = vi.fn();
  render(<QuickAccessGroupHeader name="Reuniões" onRename={onRename} />);
  fireEvent.click(screen.getByRole('button', { name: 'Renomear grupo Reuniões' }));
  return { onRename, field: screen.getByLabelText('Novo nome do grupo Reuniões') };
};

describe('QuickAccessGroupHeader', () => {
  it('shows the name with a pencil', () => {
    render(<QuickAccessGroupHeader name="Reuniões" onRename={vi.fn()} />);

    expect(screen.getByText('Reuniões')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Renomear grupo Reuniões' })).toBeInTheDocument();
  });

  it('renames with Enter, without the spaces around the new name', () => {
    const { onRename, field } = renderHeader();
    expect(field).toHaveValue('Reuniões');

    fireEvent.change(field, { target: { value: '  Orientações ' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledWith('Orientações');
    expect(screen.getByText('Reuniões')).toBeInTheDocument();
  });

  it('keeps the old name with Esc or when the field loses focus', () => {
    const { onRename, field } = renderHeader();
    fireEvent.change(field, { target: { value: 'Outro' } });

    fireEvent.keyDown(field, { key: 'Escape' });

    expect(onRename).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Renomear grupo Reuniões' }));
    fireEvent.blur(screen.getByLabelText('Novo nome do grupo Reuniões'));
    expect(onRename).not.toHaveBeenCalled();
  });

  it('does nothing when the name was not changed or was emptied', () => {
    const { onRename, field } = renderHeader();
    fireEvent.keyDown(field, { key: 'Enter' });

    fireEvent.click(screen.getByRole('button', { name: 'Renomear grupo Reuniões' }));
    const again = screen.getByLabelText('Novo nome do grupo Reuniões');
    fireEvent.change(again, { target: { value: '   ' } });
    fireEvent.keyDown(again, { key: 'Enter' });

    expect(onRename).not.toHaveBeenCalled();
  });
});

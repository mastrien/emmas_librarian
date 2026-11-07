import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SegmentedControl } from '../SegmentedControl';

const VIEWS = [
  { value: 'cards' as const, label: 'Por Evento/Revista' },
  { value: 'list' as const, label: 'Lista de Prazos' },
];

describe('SegmentedControl (Arca 134)', () => {
  it('marks the current option and reports the one chosen', () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Visualização" options={VIEWS} value="cards" onChange={onChange} />);

    expect(screen.getByRole('group', { name: 'Visualização' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Por Evento/Revista' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Lista de Prazos' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Lista de Prazos' }));
    expect(onChange).toHaveBeenCalledWith('list');
  });
});

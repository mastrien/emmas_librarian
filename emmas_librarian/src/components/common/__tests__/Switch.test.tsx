import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Switch } from '../Switch';

describe('Switch', () => {
  it('is a switch named by its text, in the state it is given', () => {
    render(
      <Switch checked onChange={vi.fn()}>
        Só pendentes
      </Switch>,
    );

    expect(screen.getByRole('switch', { name: 'Só pendentes' })).toBeChecked();
  });

  it('tells the new state when clicked, by the text or by the switch', () => {
    const onChange = vi.fn();
    render(
      <Switch checked={false} onChange={onChange}>
        Só pendentes
      </Switch>,
    );

    fireEvent.click(screen.getByText('Só pendentes'));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('cannot be changed while disabled', () => {
    render(
      <Switch checked={false} onChange={vi.fn()} disabled>
        Só pendentes
      </Switch>,
    );

    expect(screen.getByRole('switch', { name: 'Só pendentes' })).toBeDisabled();
  });
});

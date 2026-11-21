import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DEFAULT_APPEARANCE } from '../../../../src/theme/appearance';
import { LookProvider, useLook } from '../LookContext';

const Probe = () => {
  const { look, setLook } = useLook();
  return (
    <>
      <output data-testid="accent">{look.accent}</output>
      <button onClick={() => setLook({ ...look, accent: 'green' })}>green</button>
    </>
  );
};

describe('useLook', () => {
  it('has the desktop’s default look, and ignores a change, outside a provider', () => {
    render(<Probe />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('accent')).toHaveTextContent(DEFAULT_APPEARANCE.accent);
  });

  it('keeps going when the storage refuses the choice', () => {
    const blocked = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
    };
    render(
      <LookProvider initial={DEFAULT_APPEARANCE} storage={blocked} root={document.documentElement}>
        <Probe />
      </LookProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('accent')).toHaveTextContent('green');
    expect(document.documentElement.dataset.accent).toBe('green');
  });
});

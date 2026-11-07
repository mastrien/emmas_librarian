import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { KeyField } from '../KeyField';

describe('KeyField (Arca 134: one field for the bases and the AI providers)', () => {
  it('labels a masked key input and reports what is typed', () => {
    const onChange = vi.fn();
    render(<KeyField label="Scopus API Key" value="" onChange={onChange} placeholder="Insira sua chave..." />);

    const input = screen.getByLabelText('Scopus API Key');
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('shows an endpoint in clear text, with its title and hint', () => {
    render(
      <KeyField
        label="Ollama URL"
        value="http://127.0.0.1:11434/v1"
        onChange={vi.fn()}
        placeholder="http://..."
        secret={false}
        title="Endereço do Ollama"
        hint="Sem barra no fim."
      />,
    );

    const input = screen.getByLabelText('Ollama URL');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('title', 'Endereço do Ollama');
    expect(screen.getByText('Sem barra no fim.')).toHaveClass('settings-hint');
  });
});

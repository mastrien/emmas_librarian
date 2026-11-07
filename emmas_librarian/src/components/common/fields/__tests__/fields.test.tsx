import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SelectField, TextArea, TextField } from '..';

const INTERVALS = [
  { value: '1', label: 'Todo dia' },
  { value: '7', label: 'Toda semana' },
  { value: '14', label: 'A cada 2 semanas', disabled: true },
];

describe('form fields (Arca 134)', () => {
  it('labels a text field and passes native props and edits through', () => {
    const onChange = vi.fn();
    render(<TextField label="DOI" value="10.1" onChange={onChange} placeholder="10.xxxx" required />);

    const input = screen.getByLabelText('DOI');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('placeholder', '10.xxxx');
    expect(input).toBeRequired();
    expect(input).toHaveClass('input-field', 'field-control');
    fireEvent.change(input, { target: { value: '10.2' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('describes the control with its hint', () => {
    render(<TextField label="Autores" hint="Separe com ;" />);

    expect(screen.getByLabelText('Autores')).toHaveAccessibleDescription('Separe com ;');
    expect(screen.getByLabelText('Autores')).not.toHaveAttribute('aria-invalid');
  });

  it('shows the error instead of the hint and marks the control invalid', () => {
    render(<TextField label="Ano" hint="Quatro dígitos" error="Ano inválido: 20xx" />);

    const input = screen.getByLabelText('Ano');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Ano inválido: 20xx');
    expect(screen.getByRole('alert')).toHaveTextContent('Ano inválido: 20xx');
    expect(screen.queryByText('Quatro dígitos')).not.toBeInTheDocument();
  });

  it('keeps an id given by the caller', () => {
    render(<TextField id="busca-termo" label="Termo" />);

    expect(screen.getByLabelText('Termo')).toHaveAttribute('id', 'busca-termo');
  });

  it('gives a textarea a fixed height through a CSS variable and no resize handle class', () => {
    render(<TextArea label="Resumo" height="120px" defaultValue="texto" />);

    const textarea = screen.getByLabelText('Resumo');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveClass('field-textarea');
    expect(textarea.style.getPropertyValue('--field-height')).toBe('120px');
  });

  it('lists the options of a select with its own arrow class and reports the choice', () => {
    const onChange = vi.fn();
    render(<SelectField label="Intervalo" value="7" onChange={onChange} options={INTERVALS} />);

    const select = screen.getByLabelText('Intervalo') as HTMLSelectElement;
    expect([...select.options].map((o) => [o.text, o.disabled])).toEqual([
      ['Todo dia', false],
      ['Toda semana', false],
      ['A cada 2 semanas', true],
    ]);
    expect(select).toHaveClass('select-field');
    fireEvent.change(select, { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('makes a compact field denser', () => {
    render(<SelectField label="Base" compact options={INTERVALS} />);

    expect(screen.getByLabelText('Base')).toHaveClass('input-compact');
    expect(screen.getByText('Base').parentElement).toHaveClass('field--compact');
  });
});

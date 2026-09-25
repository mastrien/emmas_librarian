import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LabeledField } from '../common/LabeledField';

describe('LabeledField', () => {
  it('associates the label with a single-line input and reports edits', () => {
    const onChange = vi.fn();
    render(<LabeledField label="Título" value="A" onChange={onChange} name="title" placeholder="Ex" required />);

    const input = screen.getByLabelText('Título');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('name', 'title');
    expect(input).toHaveAttribute('placeholder', 'Ex');
    expect(input).toBeRequired();
    expect(input).toHaveValue('A');

    fireEvent.change(input, { target: { value: 'B' } });
    expect(onChange).toHaveBeenCalledWith('B');
  });

  it('renders a textarea for multiline fields', () => {
    const onChange = vi.fn();
    render(<LabeledField label="Resumo" value="texto" onChange={onChange} multiline />);

    const textarea = screen.getByLabelText('Resumo');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.style.height).toBe('100px');
    fireEvent.change(textarea, { target: { value: 'novo' } });
    expect(onChange).toHaveBeenCalledWith('novo');
  });

  it('accepts a custom textarea height', () => {
    render(<LabeledField label="Resumo" value="" onChange={vi.fn()} multiline textareaHeight="80px" />);

    expect(screen.getByLabelText('Resumo').style.height).toBe('80px');
  });

  it('passes the input type through', () => {
    render(<LabeledField label="Ano" value={2020} onChange={vi.fn()} type="number" />);

    expect(screen.getByLabelText('Ano')).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('Ano')).toHaveValue(2020);
  });

  it('shows a hint only when given', () => {
    const { rerender } = render(<LabeledField label="Autores" value="" onChange={vi.fn()} hint="Separe com ;" />);
    expect(screen.getByText('Separe com ;')).toBeInTheDocument();

    rerender(<LabeledField label="Autores" value="" onChange={vi.fn()} />);
    expect(screen.queryByText('Separe com ;')).not.toBeInTheDocument();
  });

  it('uses the dense styling when compact', () => {
    render(
      <>
        <LabeledField label="Normal" value="" onChange={vi.fn()} />
        <LabeledField label="Denso" value="" onChange={vi.fn()} compact />
      </>,
    );

    expect(screen.getByLabelText('Normal').style.padding).toBe('0.6rem 0.8rem');
    expect(screen.getByText('Normal').style.fontWeight).toBe('600');
    expect(screen.getByLabelText('Denso').style.padding).toBe('0.5rem');
    expect(screen.getByText('Denso').style.fontWeight).toBe('');
  });
});

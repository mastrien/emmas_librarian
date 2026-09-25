import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CitationMetadataFields } from '../CitationMetadataFields';
import type { CitationFields } from '../../../../utils/cslMetadata';

const fields: CitationFields = {
  title: 'T',
  authors: 'A',
  year: '2020',
  doi: 'd',
  journal: 'j',
  volume: 'v',
  issue: 'i',
  pages: 'p',
  url: 'u',
  accessed: '2024-01-02',
};

describe('CitationMetadataFields', () => {
  it('renders every citation field with its value', () => {
    render(<CitationMetadataFields fields={fields} onChange={vi.fn()} />);

    const values = Object.keys(fields).map(
      (name) => (document.querySelector(`input[name="${name}"]`) as HTMLInputElement).value,
    );
    expect(values).toEqual(Object.values(fields));
  });

  it.each([
    ['Título', 'title'],
    ['Autores (separados por ; ou ,)', 'authors'],
    ['Páginas', 'pages'],
    ['Acesso em', 'accessed'],
  ] as const)('reports changes to "%s" as %s', (label, field) => {
    const onChange = vi.fn();
    render(<CitationMetadataFields fields={fields} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(label), { target: { value: field === 'accessed' ? '2025-05-05' : 'novo' } });

    expect(onChange).toHaveBeenCalledWith(field, field === 'accessed' ? '2025-05-05' : 'novo');
  });

  it('uses number and date inputs for year and access date', () => {
    render(<CitationMetadataFields fields={fields} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Ano')).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('Acesso em')).toHaveAttribute('type', 'date');
  });
});

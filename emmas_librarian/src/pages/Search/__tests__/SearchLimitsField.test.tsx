import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { SearchLimitsField } from '../SearchLimitsField';
import type { SearchLimits } from '../../../utils/searchLimits';

/** Holds the limits like the search page does, so each change re-renders the field. */
function Harness({
  initial,
  selected,
  onChange,
}: {
  initial: SearchLimits;
  selected: string[];
  onChange?: (l: SearchLimits) => void;
}) {
  const [limits, setLimits] = useState(initial);
  return (
    <SearchLimitsField
      limits={limits}
      selected={selected}
      inputStyle={{}}
      onChange={(next) => {
        setLimits(next);
        onChange?.(next);
      }}
    />
  );
}

describe('SearchLimitsField', () => {
  it('opens the per-base adjustments when the search already has one', () => {
    render(<Harness initial={{ common: 1000, perBase: { wos: 500 } }} selected={['openalex', 'wos']} />);

    expect(screen.getByLabelText('Web of Science')).toBeVisible();
    expect(screen.getByLabelText('Web of Science')).toHaveValue(500);
    expect(screen.getByLabelText('OpenAlex')).toHaveValue(null);
  });

  it('shows the ceiling and the cost of each base, WoS with its pause between pages', () => {
    render(<Harness initial={{ common: 1000, perBase: {} }} selected={['crossref', 'wos']} />);

    expect(screen.getByText('máx. 10.000 · 1 requisição')).toBeInTheDocument();
    expect(screen.getByText('máx. 2.500 · 20 requisições · ~21 s')).toBeInTheDocument();
  });

  it('returns a base to the common value when its adjustment is cleared', () => {
    const onChange = vi.fn();
    render(<Harness initial={{ common: 1000, perBase: { wos: 500 } }} selected={['wos']} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Web of Science'), { target: { value: '' } });

    expect(onChange).toHaveBeenLastCalledWith({ common: 1000, perBase: {} });
    expect(screen.getByLabelText('Resultados pedidos a cada base')).toHaveTextContent('Web of Science 1.000');
  });

  it('names the base and the value asked when an adjustment passes the ceiling', () => {
    render(<Harness initial={{ common: 1000, perBase: {} }} selected={['wos']} />);
    fireEvent.click(screen.getByText('Ajustar por base'));

    fireEvent.change(screen.getByLabelText('Web of Science'), { target: { value: '3000' } });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Web of Science aceita até 2.500 resultados (você pediu 3.000).',
    );
  });
});

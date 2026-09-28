import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { FilterChips, resultCountLabel } from '../ResultLine';
import type { ActiveFilter } from '../../../hooks/articleFilters';

const FILTERS: ActiveFilter[] = [
  { key: 'pdf', label: 'Com PDF' },
  { key: 'oa', label: 'Acesso aberto' },
  { key: 'database:Scopus', label: 'Scopus' },
  { key: 'keyword', label: '"radar"' },
];

// jsdom has no layout: give every measured element 100px and the chip line a fixed width.
function fakeLayout(lineWidth: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(lineWidth);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 100 } as DOMRect);
}

const renderChips = () => {
  const handlers = { onRemove: vi.fn(), onShowAll: vi.fn(), onClear: vi.fn() };
  render(<FilterChips filters={FILTERS} {...handlers} />);
  return { ...handlers, line: within(screen.getByLabelText('Filtros ativos')) };
};

describe('FilterChips', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps all chips when the line is wide enough', () => {
    fakeLayout(1000);

    const { line } = renderChips();

    expect(line.getAllByRole('button', { name: /^Remover filtro/ })).toHaveLength(4);
    expect(line.queryByRole('button', { name: /^\+\d/ })).not.toBeInTheDocument();
  });

  it('stays on one line by turning the chips that do not fit into "+N filtros"', () => {
    // 2 chips (2 × 106.4) + "+N" (106.4) + "Limpar" (100) = 419.2 ≤ 420
    fakeLayout(420);

    const { line, onShowAll } = renderChips();

    expect(line.getAllByRole('button', { name: /^Remover filtro/ }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Remover filtro Com PDF',
      'Remover filtro Acesso aberto',
    ]);
    fireEvent.click(line.getByRole('button', { name: '+2 filtros' }));
    expect(onShowAll).toHaveBeenCalled();
  });

  it('removes a chip and clears all', () => {
    fakeLayout(1000);
    const { line, onRemove, onClear } = renderChips();

    fireEvent.click(line.getByRole('button', { name: 'Remover filtro Scopus' }));
    fireEvent.click(line.getByRole('button', { name: 'Limpar' }));

    expect(onRemove).toHaveBeenCalledWith('database:Scopus');
    expect(onClear).toHaveBeenCalled();
  });
});

describe('resultCountLabel', () => {
  it('agrees the noun with the total, filtered or not', () => {
    expect(resultCountLabel(3, 3)).toBe('3 artigos');
    expect(resultCountLabel(1, 1)).toBe('1 artigo');
    expect(resultCountLabel(0, 1)).toBe('0 de 1 artigo');
    expect(resultCountLabel(1, 3)).toBe('1 de 3 artigos');
  });
});

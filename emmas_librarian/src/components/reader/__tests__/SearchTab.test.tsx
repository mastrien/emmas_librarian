import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchTab } from '../SearchTab';

type Props = React.ComponentProps<typeof SearchTab>;

function renderSearchTab(overrides: Partial<Props> = {}) {
  const props: Props = {
    searchQuery: '',
    setSearchQuery: vi.fn(),
    isSearching: false,
    searchResults: [],
    onSearch: vi.fn((e: React.FormEvent) => e.preventDefault()),
    onResultClick: vi.fn(),
    ...overrides,
  };
  render(<SearchTab {...props} />);
  return props;
}

const submitButton = () => screen.getByRole('button');

describe('SearchTab', () => {
  it('prompts for a term when the query is empty and disables submit', () => {
    renderSearchTab();

    expect(screen.getByText('Digite um termo para pesquisar.')).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('keeps submit disabled for a whitespace-only query', () => {
    renderSearchTab({ searchQuery: '   ' });

    expect(submitButton()).toBeDisabled();
  });

  it('reports no results for a non-empty query', () => {
    renderSearchTab({ searchQuery: 'entropy' });

    expect(screen.getByText('Nenhum resultado encontrado.')).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it('forwards typing to setSearchQuery', () => {
    const props = renderSearchTab();

    fireEvent.change(screen.getByPlaceholderText('Termo para busca...'), { target: { value: 'gene' } });

    expect(props.setSearchQuery).toHaveBeenCalledWith('gene');
  });

  it('submits the form through onSearch', () => {
    const props = renderSearchTab({ searchQuery: 'gene' });

    fireEvent.click(submitButton());

    expect(props.onSearch).toHaveBeenCalledTimes(1);
  });

  it('shows a loading state and disables submit while searching', () => {
    renderSearchTab({ searchQuery: 'gene', isSearching: true, searchResults: [{ pageNumber: 1, snippet: 'x' }] });

    expect(screen.getByText('Pesquisando termo...')).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    expect(screen.queryByText('Página 1')).not.toBeInTheDocument();
  });

  it('lists results with a count and highlights the term case-insensitively', () => {
    renderSearchTab({
      searchQuery: 'dna',
      searchResults: [
        { pageNumber: 3, snippet: 'The DNA helix' },
        { pageNumber: 8, snippet: 'unrelated text' },
      ],
    });

    expect(screen.getByText('2 ocorrência(s) encontrada(s)')).toBeInTheDocument();
    const mark = screen.getByText('DNA');
    expect(mark.tagName).toBe('MARK');
    expect(mark.parentElement).toHaveTextContent('The DNA helix');
    expect(screen.getByText('unrelated text').querySelector('mark')).toBeNull();
  });

  it('navigates to the page of a clicked result', () => {
    const props = renderSearchTab({ searchQuery: 'x', searchResults: [{ pageNumber: 5, snippet: 'x marks' }] });

    fireEvent.click(screen.getByText('Página 5'));

    expect(props.onResultClick).toHaveBeenCalledWith(5);
  });
});

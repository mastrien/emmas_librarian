import type React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SearchSummaryPanel } from '../SearchSummaryPanel';
import { SearchStep } from '../SearchStep';

const renderPanel = (overrides: Partial<React.ComponentProps<typeof SearchSummaryPanel>> = {}) =>
  render(
    <SearchSummaryPanel
      readableQuery='(Título contém "chuva")'
      selected={['openalex']}
      translations={{ openalex: { query: 'title.search:chuva', isValid: true } }}
      customQueries={{}}
      onCustomQueryChange={vi.fn()}
      maxResults={1000}
      loading={false}
      disabled={false}
      error={null}
      {...overrides}
    />,
  );

describe('SearchSummaryPanel', () => {
  it('shows the query in words and how each chosen base receives it', () => {
    renderPanel();

    expect(screen.getByText('(Título contém "chuva")')).toBeInTheDocument();
    expect(screen.getByText('title.search:chuva')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fazer busca/ })).toBeEnabled();
  });

  // A search can take minutes: the button says so instead of the shortcut.
  it('tells the user the search is running and hides the shortcut', () => {
    renderPanel({ loading: true, disabled: true });

    const button = screen.getByRole('button', { name: /Buscando/ });
    expect(button).toBeDisabled();
    expect(button).not.toHaveTextContent('Ctrl Enter');
  });

  it('shows the error above the button', () => {
    renderPanel({ error: 'A busca falhou' });

    expect(screen.getByRole('alert')).toHaveTextContent('A busca falhou');
  });
});

describe('SearchStep', () => {
  it('numbers the step and names it as a heading', () => {
    render(
      <SearchStep number={2} title="Query" aside="opcional">
        <p>conteúdo</p>
      </SearchStep>,
    );

    expect(screen.getByRole('heading', { name: 'Query' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('opcional')).toBeInTheDocument();
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatabaseSelector } from '../DatabaseSelector';

const NO_KEYS = { scopus: '', wos: '', ieee: '' };

describe('DatabaseSelector', () => {
  it('tags only IEEE Xplore as experimental', () => {
    render(<DatabaseSelector selected={['openalex']} onToggle={vi.fn()} apiKeys={NO_KEYS} />);

    expect(screen.getByRole('button', { name: 'IEEE Xplore (experimental)' })).toBeInTheDocument();
    expect(screen.getAllByText('Exp.')).toHaveLength(1);
  });

  it('explains the experimental state only while IEEE Xplore is selected', () => {
    const { rerender } = render(<DatabaseSelector selected={['openalex']} onToggle={vi.fn()} apiKeys={NO_KEYS} />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();

    rerender(<DatabaseSelector selected={['openalex', 'ieee']} onToggle={vi.fn()} apiKeys={NO_KEYS} />);

    expect(screen.getByRole('note')).toHaveTextContent(/não foi testada com uma chave real/);
  });

  it('toggles a base by its id', () => {
    const onToggle = vi.fn();
    render(<DatabaseSelector selected={[]} onToggle={onToggle} apiKeys={NO_KEYS} />);

    fireEvent.click(screen.getByRole('button', { name: /arXiv/ }));

    expect(onToggle).toHaveBeenCalledWith('arxiv');
  });

  // Decision on the redesign canvas (board 158): the key says whether the base's API key is saved.
  it('marks the bases that need a key, in the accent when it is saved and grey when it is missing', () => {
    const { container } = render(
      <DatabaseSelector selected={[]} onToggle={vi.fn()} apiKeys={{ scopus: 'abc', wos: '', ieee: '' }} />,
    );

    expect(container.querySelector('.search-db-key--saved')?.closest('button')).toHaveTextContent('Scopus');
    expect(container.querySelectorAll('.search-db-key--missing')).toHaveLength(2);
  });

  it('checks the chosen bases', () => {
    render(<DatabaseSelector selected={['openalex']} onToggle={vi.fn()} apiKeys={NO_KEYS} />);

    expect(screen.getByRole('button', { name: 'OpenAlex' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /arXiv/ })).toHaveAttribute('aria-pressed', 'false');
  });
});

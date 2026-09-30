import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatabaseSelector } from '../DatabaseSelector';

describe('DatabaseSelector', () => {
  it('tags only IEEE Xplore as experimental', () => {
    render(<DatabaseSelector selected={['openalex']} onToggle={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'IEEE Xplore (experimental)' })).toBeInTheDocument();
    expect(screen.getAllByText('Experimental')).toHaveLength(1);
  });

  it('explains the experimental state only while IEEE Xplore is selected', () => {
    const { rerender } = render(<DatabaseSelector selected={['openalex']} onToggle={vi.fn()} />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();

    rerender(<DatabaseSelector selected={['openalex', 'ieee']} onToggle={vi.fn()} />);

    expect(screen.getByRole('note')).toHaveTextContent(/não foi testada com uma chave real/);
  });

  it('toggles a base by its id', () => {
    const onToggle = vi.fn();
    render(<DatabaseSelector selected={[]} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: /arXiv/ }));

    expect(onToggle).toHaveBeenCalledWith('arxiv');
  });
});

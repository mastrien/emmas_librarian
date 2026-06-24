import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SearchSummaryModal } from '../modals/SearchSummaryModal';

describe('SearchSummaryModal', () => {
  const mockSummary = {
    savedCount: 4,
    breakdown: {
      openalex: { count: 3 },
      wos: { count: 2 },
      crossref: { count: 0, error: 'API Timeout' },
    },
  };

  it('does not render when isOpen is false', () => {
    const { container } = render(<SearchSummaryModal isOpen={false} onClose={vi.fn()} summary={mockSummary} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders summary counts and breakdown with errors', () => {
    const onClose = vi.fn();
    render(<SearchSummaryModal isOpen={true} onClose={onClose} summary={mockSummary} />);

    expect(screen.getByText('Busca Concluída!')).toBeInTheDocument();
    expect(screen.getByText('Total Encontrado')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // total found is 3 + 2 + 0 = 5
    expect(screen.getByText('Salvos no Projeto')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument(); // savedCount is 4

    // Breakdown checks
    expect(screen.getByText('openalex')).toBeInTheDocument();
    expect(screen.getByText('Web of Science')).toBeInTheDocument(); // wos maps to Web of Science
    expect(screen.getByText('crossref')).toBeInTheDocument();
    expect(screen.getByText('Falha')).toBeInTheDocument();
    expect(screen.getByText('API Timeout')).toBeInTheDocument();

    // Buttons
    const viewArticlesBtn = screen.getByText('Ver Artigos do Projeto');
    fireEvent.click(viewArticlesBtn);
    expect(onClose).toHaveBeenCalled();
  });
});

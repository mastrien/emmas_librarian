import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchHistoryModal } from '../modals/SearchHistoryModal';

describe('SearchHistoryModal', () => {
  const mockHistory = [
    {
      id: 1,
      unified_query: 'machine learning OR artificial intelligence',
      translated_queries: JSON.stringify({ openalex: 'machine learning OR artificial intelligence', wos: 'TS=("machine learning" OR "artificial intelligence")' }),
      total_results: 15,
      results_breakdown: JSON.stringify({ openalex: { count: 10 }, wos: { count: 5 } }),
      created_at: '2026-06-03T12:00:00.000Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <SearchHistoryModal isOpen={false} onClose={vi.fn()} history={mockHistory} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders "Nenhuma busca registrada ainda" when history is empty', () => {
    render(
      <SearchHistoryModal isOpen={true} onClose={vi.fn()} history={[]} />
    );
    expect(screen.getByText('Nenhuma busca registrada ainda.')).toBeInTheDocument();
  });

  it('renders history content in modal mode', () => {
    const onClose = vi.fn();
    const onRevertSearch = vi.fn();
    render(
      <SearchHistoryModal
        isOpen={true}
        onClose={onClose}
        history={mockHistory}
        onRevertSearch={onRevertSearch}
      />
    );

    expect(screen.getAllByText('Histórico de Buscas')[0]).toBeInTheDocument();
    expect(screen.getAllByText('machine learning OR artificial intelligence')[0]).toBeInTheDocument();
    expect(screen.getByText('15 artigos salvos')).toBeInTheDocument();
    expect(screen.getByText('openalex')).toBeInTheDocument();
    expect(screen.getByText('Web of Science')).toBeInTheDocument();

    const revertBtn = screen.getByText('Desfazer Busca');
    fireEvent.click(revertBtn);
    expect(window.confirm).toHaveBeenCalled();
    expect(onRevertSearch).toHaveBeenCalledWith(1);

    const closeBtn = screen.getByRole('button', { name: '' }); // the X button
    // It has X SVG inside. Let's find button with top: 1.5rem
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders history content in embedded mode', () => {
    render(
      <SearchHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        history={mockHistory}
        embedded={true}
      />
    );

    // No close button in embedded mode
    expect(screen.queryByRole('button', { name: 'X' })).toBeNull();
    expect(screen.getAllByText('machine learning OR artificial intelligence')[0]).toBeInTheDocument();
  });
});

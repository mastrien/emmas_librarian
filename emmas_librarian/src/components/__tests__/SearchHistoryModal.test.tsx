import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SearchHistoryModal } from '../modals/SearchHistoryModal';

describe('SearchHistoryModal', () => {
  const mockHistory = [
    {
      id: 1,
      unified_query: 'machine learning OR artificial intelligence',
      translated_queries: JSON.stringify({
        openalex: 'machine learning OR artificial intelligence',
        wos: 'TS=("machine learning" OR "artificial intelligence")',
      }),
      total_results: 15,
      results_breakdown: JSON.stringify({ openalex: { count: 10 }, wos: { count: 5 } }),
      created_at: '2026-06-03T12:00:00.000Z',
      sort_by: 'citations',
      limit_val: 15,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<SearchHistoryModal isOpen={false} onClose={vi.fn()} history={mockHistory} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders "Nenhuma busca registrada ainda" when history is empty', () => {
    render(<SearchHistoryModal isOpen={true} onClose={vi.fn()} history={[]} />);
    expect(screen.getByText('Nenhuma busca registrada ainda.')).toBeInTheDocument();
  });

  it('renders history content in modal mode', () => {
    const onClose = vi.fn();
    const onRevertSearch = vi.fn();
    render(
      <SearchHistoryModal isOpen={true} onClose={onClose} history={mockHistory} onRevertSearch={onRevertSearch} />,
    );

    expect(screen.getAllByText('Histórico de Buscas')[0]).toBeInTheDocument();
    expect(screen.getAllByText('machine learning OR artificial intelligence')[0]).toBeInTheDocument();
    expect(screen.getByText('15 artigos salvos')).toBeInTheDocument();
    const byBase = within(screen.getByRole('region', { name: 'Resultados por base desta busca' }));
    expect(byBase.getByText('OpenAlex:', { exact: false })).toHaveTextContent('OpenAlex: 10');
    expect(byBase.getByText('Web of Science:', { exact: false })).toHaveTextContent('Web of Science: 5');
    expect(screen.getByText('Citações')).toBeInTheDocument();
    expect(screen.getByText('15 por base')).toBeInTheDocument();

    const revertBtn = screen.getByText('Desfazer Busca');
    fireEvent.click(revertBtn);
    expect(window.confirm).toHaveBeenCalled();
    expect(onRevertSearch).toHaveBeenCalledWith(1);

    const closeBtn = screen.getByRole('button', { name: '' }); // the X button
    // It has X SVG inside. Let's find button with top: 1.5rem
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  // Traceability: what was asked of each base, what it had, why it stopped and what the search cost.
  it('shows the limits, totals, stops, distinct results and requests recorded for a paged search', () => {
    const paged = {
      ...mockHistory[0],
      id: 2,
      limit_val: 1000,
      unique_results: 1180,
      query_state: JSON.stringify({
        ast: {},
        selectedDbs: ['openalex', 'wos'],
        customQueries: {},
        limits: { common: 1000, perBase: { wos: 500 } },
      }),
      results_breakdown: JSON.stringify({
        openalex: { count: 1000, requested: 1000, available: 5321, requests: 10 },
        wos: {
          count: 150,
          requested: 500,
          available: 900,
          requests: 4,
          warning: 'a busca parou em 150 de 500 resultados (Erro 429).',
        },
        scopus: { count: 0, requested: 1000, error: 'Chave de API inválida ou expirada' },
      }),
    };

    render(<SearchHistoryModal isOpen onClose={vi.fn()} history={[paged]} />);

    expect(screen.getByText('1.000 por base (Web of Science 500)')).toBeInTheDocument();
    const byBase = within(screen.getByRole('region', { name: 'Resultados por base desta busca' }));
    expect(byBase.getByText('1.000 de 5.321 na base')).toBeInTheDocument();
    expect(byBase.getByText('150 de 900 na base')).toBeInTheDocument();
    expect(byBase.getByText('Web of Science: a busca parou em 150 de 500 resultados (Erro 429).')).toBeInTheDocument();
    expect(byBase.getByText('Scopus: Chave de API inválida ou expirada')).toBeInTheDocument();
    expect(byBase.getByText('Únicos entre as bases: 1.180')).toBeInTheDocument();
    expect(byBase.getByText('Requisições: OpenAlex 10 · Web of Science 4')).toBeInTheDocument();
  });

  it('keeps the list readable when an entry has a malformed breakdown', () => {
    render(
      <SearchHistoryModal isOpen onClose={vi.fn()} history={[{ ...mockHistory[0], results_breakdown: '{broken' }]} />,
    );

    expect(screen.getByText('15 artigos salvos')).toBeInTheDocument();
  });

  it('renders history content in embedded mode', () => {
    render(<SearchHistoryModal isOpen={true} onClose={vi.fn()} history={mockHistory} embedded={true} />);

    // No close button in embedded mode
    expect(screen.queryByRole('button', { name: 'X' })).toBeNull();
    expect(screen.getAllByText('machine learning OR artificial intelligence')[0]).toBeInTheDocument();
  });

  describe('"Nova busca a partir desta"', () => {
    const importEntry = {
      ...mockHistory[0],
      id: 2,
      unified_query: "Importação de artigos do projeto 'Fonte'",
      translated_queries: JSON.stringify({ import: 'Origem: Projeto ID 3' }),
    };

    it('links a database search to the search page preloaded with it', () => {
      render(
        <MemoryRouter>
          <SearchHistoryModal isOpen onClose={vi.fn()} history={mockHistory} embedded projectId={4} />
        </MemoryRouter>,
      );

      expect(screen.getByRole('link', { name: /Nova busca a partir desta/ })).toHaveAttribute(
        'href',
        '/projects/4/search?from=1',
      );
    });

    it('is not offered for an import from another project', () => {
      render(
        <MemoryRouter>
          <SearchHistoryModal isOpen onClose={vi.fn()} history={[importEntry]} embedded projectId={4} />
        </MemoryRouter>,
      );

      expect(screen.queryByRole('link', { name: /Nova busca a partir desta/ })).not.toBeInTheDocument();
    });
  });
});

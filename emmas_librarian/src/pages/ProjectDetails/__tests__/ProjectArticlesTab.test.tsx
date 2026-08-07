import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectArticlesTab } from '../components/ProjectArticlesTab';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../components/ProjectArticlesList', () => ({
  ProjectArticlesList: () => <div data-testid="ProjectArticlesList">List</div>
}));

vi.mock('../components/ProjectSidebar', () => ({
  ProjectSidebar: () => <div data-testid="ProjectSidebar">Sidebar</div>
}));

describe('ProjectArticlesTab', () => {
  const defaultProps = {
    searchTerm: '',
    setSearchTerm: vi.fn(),
    onlyWithPdf: false,
    setOnlyWithPdf: vi.fn(),
    onlyOpenAccess: false,
    setOnlyOpenAccess: vi.fn(),
    isSidebarOpen: false,
    setIsSidebarOpen: vi.fn(),
    sortOrder: 'year-desc',
    setSortOrder: vi.fn(),
    statusFilter: 'all' as any,
    setStatusFilter: vi.fn(),
    uniqueDatabases: [],
    selectedDatabases: [],
    setSelectedDatabases: vi.fn(),
    uniqueDocTypes: [],
    selectedDocType: '',
    setSelectedDocType: vi.fn(),
    keywordFrequencies: [],
    selectedKeyword: '',
    setSelectedKeyword: vi.fn(),
    currentPage: 1,
    setCurrentPage: vi.fn(),
    totalPages: 1,
    activeArticles: [],
    readArticles: [],
    archivedArticles: [],
    paginatedArticles: [],
    isReadArticlesOpen: false,
    setIsReadArticlesOpen: vi.fn(),
    isArchivedArticlesOpen: false,
    setIsArchivedArticlesOpen: vi.fn(),
    modals: {
      setIsMassCitationModalOpen: vi.fn(),
      setSelectedArticleForDetails: vi.fn(),
      setCitationArticle: vi.fn(),
    },
    handleUnlinkClick: vi.fn(),
    handleUploadClick: vi.fn(),
    uploadingId: null,
    handleStatusChange: vi.fn(),
    isArticleManual: vi.fn().mockReturnValue(false),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouter>
        <ProjectArticlesTab {...defaultProps} {...props} />
      </MemoryRouter>
    );
  };

  it('renders filters and list', () => {
    renderComponent();
    expect(screen.getByPlaceholderText('Filtrar por título ou autor...')).toBeInTheDocument();
    expect(screen.getByText('Apenas com PDF vinculado')).toBeInTheDocument();
    expect(screen.getByText('Apenas Acesso Aberto')).toBeInTheDocument();
    expect(screen.getByText('Filtros')).toBeInTheDocument();
    expect(screen.getByTestId('ProjectArticlesList')).toBeInTheDocument();
  });

  it('handles search term change', () => {
    renderComponent();
    const input = screen.getByPlaceholderText('Filtrar por título ou autor...');
    act(() => {
      fireEvent.change(input, { target: { value: 'test search' } });
    });
    expect(defaultProps.setSearchTerm).toHaveBeenCalledWith('test search');
    expect(defaultProps.setCurrentPage).toHaveBeenCalledWith(1);
  });

  it('handles PDF filter change', () => {
    renderComponent();
    const checkbox = screen.getByLabelText('Apenas com PDF vinculado');
    act(() => {
      fireEvent.click(checkbox);
    });
    expect(defaultProps.setOnlyWithPdf).toHaveBeenCalledWith(true);
    expect(defaultProps.setCurrentPage).toHaveBeenCalledWith(1);
  });

  it('handles Open Access filter change', () => {
    renderComponent();
    const checkbox = screen.getByLabelText('Apenas Acesso Aberto');
    act(() => {
      fireEvent.click(checkbox);
    });
    expect(defaultProps.setOnlyOpenAccess).toHaveBeenCalledWith(true);
    expect(defaultProps.setCurrentPage).toHaveBeenCalledWith(1);
  });

  it('handles Sidebar toggle', () => {
    renderComponent();
    const btn = screen.getByText('Filtros');
    act(() => {
      fireEvent.click(btn);
    });
    expect(defaultProps.setIsSidebarOpen).toHaveBeenCalledWith(true);
  });

  it('shows sidebar when isSidebarOpen is true', () => {
    renderComponent({ isSidebarOpen: true });
    expect(screen.getByTestId('ProjectSidebar')).toBeInTheDocument();
  });

  it('handles sort change', () => {
    renderComponent();
    const select = screen.getByDisplayValue('Mais Recentes (Ano)');
    act(() => {
      fireEvent.change(select, { target: { value: 'title-asc' } });
    });
    expect(defaultProps.setSortOrder).toHaveBeenCalledWith('title-asc');
    expect(defaultProps.setCurrentPage).toHaveBeenCalledWith(1);
  });

  it('renders read articles accordion', () => {
    const readArticles = [{ id: 1, title: 'Read Article 1' }];
    renderComponent({ readArticles });
    expect(screen.getByText('Artigos Lidos (1)')).toBeInTheDocument();
    expect(screen.getByText('Read Article 1')).toBeInTheDocument();
  });

  it('handles read articles actions', () => {
    const readArticles = [{ id: 1, title: 'Read Article 1' }];
    renderComponent({ readArticles, isReadArticlesOpen: true });
    
    // Mass citation
    const massCitationBtn = screen.getByText('Citação em Massa');
    act(() => {
      fireEvent.click(massCitationBtn);
    });
    expect(defaultProps.modals.setIsMassCitationModalOpen).toHaveBeenCalledWith(true);

    // Details
    const detailsBtn = screen.getByText('Detalhes');
    act(() => {
      fireEvent.click(detailsBtn);
    });
    expect(defaultProps.modals.setSelectedArticleForDetails).toHaveBeenCalledWith(readArticles[0]);

    // Cite
    const citeBtn = screen.getByText('Citar');
    act(() => {
      fireEvent.click(citeBtn);
    });
    expect(defaultProps.modals.setCitationArticle).toHaveBeenCalledWith(readArticles[0]);

    // Unmark
    const unmarkBtn = screen.getByText('Desmarcar');
    act(() => {
      fireEvent.click(unmarkBtn);
    });
    expect(defaultProps.handleStatusChange).toHaveBeenCalledWith(1, 'new');
  });

  it('renders archived articles accordion', () => {
    const archivedArticles = [{ id: 2, title: 'Archived Article 2', archive_note: 'Not relevant' }];
    renderComponent({ archivedArticles, isArchivedArticlesOpen: true });
    expect(screen.getByText('Artigos Arquivados (1)')).toBeInTheDocument();
    expect(screen.getByText('Archived Article 2')).toBeInTheDocument();
    expect(screen.getByText('Motivo: Not relevant')).toBeInTheDocument();
  });

  it('handles archived articles actions', () => {
    const archivedArticles = [{ id: 2, title: 'Archived Article 2' }];
    renderComponent({ archivedArticles, isArchivedArticlesOpen: true });
    
    // Restore
    const restoreBtn = screen.getByText('Restaurar');
    act(() => {
      fireEvent.click(restoreBtn);
    });
    expect(defaultProps.handleStatusChange).toHaveBeenCalledWith(2, 'new');
  });

  it('renders pagination when more than 50 articles', () => {
    const activeArticles = Array(51).fill({ id: 1 });
    renderComponent({ activeArticles, totalPages: 2 });
    
    expect(screen.getByText(/Mostrando 1-50 de 51 artigos/)).toBeInTheDocument();
    
    // Pagination buttons are present
    const prevBtns = screen.getAllByRole('button').filter(b => b.textContent?.includes('Anterior') || b.querySelector('svg.lucide-chevron-left'));
    expect(prevBtns.length).toBeGreaterThan(0);

    const nextBtns = screen.getAllByRole('button').filter(b => b.textContent?.includes('Próxima') || b.querySelector('svg.lucide-chevron-right'));
    expect(nextBtns.length).toBeGreaterThan(0);
  });
});

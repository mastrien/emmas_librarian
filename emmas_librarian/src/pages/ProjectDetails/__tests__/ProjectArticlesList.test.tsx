import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectArticlesList } from '../components/ProjectArticlesList';
import { MemoryRouter } from 'react-router-dom';

describe('ProjectArticlesList', () => {
  const defaultProps = {
    paginatedArticles: [],
    setSelectedArticleForDetails: vi.fn(),
    handleUnlinkClick: vi.fn(),
    handleUploadClick: vi.fn(),
    handleStatusChange: vi.fn(),
    setEditingArticle: vi.fn(),
    setArchivingId: vi.fn(),
    setCitationArticle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouter>
        <ProjectArticlesList {...defaultProps} {...props} />
      </MemoryRouter>,
    );
  };

  // Unlink, edit and cite live in the row's "⋯" menu.
  const chooseFromRowMenu = (item: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    fireEvent.click(screen.getByRole('menuitem', { name: item }));
  };

  it('renders empty state when no articles', () => {
    renderComponent();
    expect(screen.getByText('Nenhum artigo ativo na biblioteca.')).toBeInTheDocument();
  });

  it('renders articles list', () => {
    const paginatedArticles = [
      {
        id: 1,
        title: 'Article 1',
        authors: 'John Doe',
        doi: '10.123/1',
        year: 2021,
        citation_count: 5,
        source_databases: '["Scopus"]',
        is_oa: 1,
        local_file_path: null,
        status: 'new',
      },
    ];
    renderComponent({ paginatedArticles });

    const [articleCell, authorsCell, basesCell] = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'ARTIGO',
      'AUTORES',
      'BASES',
      'AÇÕES',
    ]);
    expect(within(articleCell).getByText('Article 1')).toBeInTheDocument();
    // Year, DOI, citations and open access describe the article, so they sit under its title.
    expect(within(articleCell).getByText('DOI 10.123/1')).toBeInTheDocument();
    expect(within(articleCell).getByText('2021')).toBeInTheDocument();
    expect(within(articleCell).getByText('5 citações')).toBeInTheDocument();
    expect(within(articleCell).getByText('Acesso aberto')).toBeInTheDocument();
    expect(authorsCell).toHaveTextContent(/^John Doe$/);
    expect(within(basesCell).getByText('Scopus')).toBeInTheDocument();
    expect(within(basesCell).queryByText(/Acesso/)).not.toBeInTheDocument();
  });

  it('handles click on article title', () => {
    const paginatedArticles = [{ id: 1, title: 'Article 1' }];
    renderComponent({ paginatedArticles });

    const titleDiv = screen.getByText('Article 1');
    act(() => {
      fireEvent.click(titleDiv);
    });

    expect(defaultProps.setSelectedArticleForDetails).toHaveBeenCalledWith(paginatedArticles[0]);
  });

  it('renders manual tag', () => {
    const paginatedArticles = [{ id: 1, title: 'Article 1', source_databases: '["Manual"]' }];
    renderComponent({ paginatedArticles });
    // The bases also render inside the article cell for narrow tables (hidden by a container query jsdom
    // does not apply), so look in the BASES column.
    const basesCell = within(screen.getAllByRole('row')[1]).getAllByRole('cell')[2];
    expect(within(basesCell).getByText('⚠️ Manual')).toBeInTheDocument();
  });

  it('handles unlink pdf click when file exists', () => {
    const paginatedArticles = [{ id: 1, title: 'Article 1', local_file_path: '/path.pdf' }];
    renderComponent({ paginatedArticles });

    chooseFromRowMenu('Desvincular PDF');

    expect(defaultProps.handleUnlinkClick).toHaveBeenCalledWith(1);
  });

  it('handles upload pdf click when file missing', () => {
    const paginatedArticles = [{ id: 1, title: 'Article 1', local_file_path: null }];
    renderComponent({ paginatedArticles });

    const uploadBtn = screen.getByTitle('Vincular PDF');
    act(() => {
      fireEvent.click(uploadBtn);
    });

    expect(defaultProps.handleUploadClick).toHaveBeenCalledWith(1);
  });

  it('handles status change to read/new', () => {
    const paginatedArticles = [
      { id: 1, title: 'New Article', status: 'new' },
      { id: 2, title: 'Read Article', status: 'read' },
      { id: 3, title: 'Archived Article', status: 'archived' },
    ];
    renderComponent({ paginatedArticles });

    const readBtn = screen.getByTitle('Marcar como Lido');
    act(() => {
      fireEvent.click(readBtn);
    });
    expect(defaultProps.handleStatusChange).toHaveBeenCalledWith(1, 'read');

    const unmarkBtn = screen.getByTitle('Desmarcar como Lido');
    act(() => {
      fireEvent.click(unmarkBtn);
    });
    expect(defaultProps.handleStatusChange).toHaveBeenCalledWith(2, 'new');

    const restoreBtn = screen.getByTitle('Restaurar Artigo');
    act(() => {
      fireEvent.click(restoreBtn);
    });
    expect(defaultProps.handleStatusChange).toHaveBeenCalledWith(3, 'new');
  });

  it('handles archiving', () => {
    const paginatedArticles = [{ id: 1, title: 'Article 1', status: 'new' }];
    renderComponent({ paginatedArticles });

    const archiveBtn = screen.getByTitle('Arquivar');
    act(() => {
      fireEvent.click(archiveBtn);
    });

    expect(defaultProps.setArchivingId).toHaveBeenCalledWith(1);
  });

  it('offers metadata editing for every article, not only manual ones', () => {
    const paginatedArticles = [{ id: 1, title: 'Search Result', status: 'new', source_databases: '["Scopus"]' }];
    renderComponent({ paginatedArticles });

    chooseFromRowMenu('Editar Metadados');

    expect(defaultProps.setEditingArticle).toHaveBeenCalledWith(paginatedArticles[0]);
  });

  it('handles citation', () => {
    const paginatedArticles = [{ id: 1, title: 'Article 1', status: 'new' }];
    renderComponent({ paginatedArticles });

    chooseFromRowMenu('Gerar Citação');

    expect(defaultProps.setCitationArticle).toHaveBeenCalledWith(paginatedArticles[0]);
  });
});

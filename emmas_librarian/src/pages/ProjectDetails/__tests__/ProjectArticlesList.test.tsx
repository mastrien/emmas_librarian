import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectArticlesList } from '../components/ProjectArticlesList';
import { MemoryRouter } from 'react-router-dom';

describe('ProjectArticlesList', () => {
  const defaultProps = {
    paginatedArticles: [],
    setSelectedArticleForDetails: vi.fn(),
    handleUnlinkClick: vi.fn(),
    handleUploadClick: vi.fn(),
    uploadingId: null,
    handleStatusChange: vi.fn(),
    setEditingArticle: vi.fn(),
    setArchivingId: vi.fn(),
    setCitationArticle: vi.fn(),
    isArticleManual: vi.fn().mockReturnValue(false),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouter>
        <ProjectArticlesList {...defaultProps} {...props} />
      </MemoryRouter>
    );
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
        status: 'new'
      }
    ];
    renderComponent({ paginatedArticles });
    
    expect(screen.getByText('Article 1')).toBeInTheDocument();
    expect(screen.getByText('DOI: 10.123/1')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('2021')).toBeInTheDocument();
    expect(screen.getByText('🎓 5 citações')).toBeInTheDocument();
    expect(screen.getByText('Scopus')).toBeInTheDocument();
    expect(screen.getByText('🔓 Acesso Aberto')).toBeInTheDocument();
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
    expect(screen.getByText('⚠️ Manual')).toBeInTheDocument();
  });

  it('handles unlink pdf click when file exists', () => {
    const paginatedArticles = [{ id: 1, title: 'Article 1', local_file_path: '/path.pdf' }];
    renderComponent({ paginatedArticles });
    
    // Find button by title or content
    const unlinkBtn = screen.getByTitle('Desvincular PDF');
    act(() => {
      fireEvent.click(unlinkBtn);
    });
    
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
      { id: 3, title: 'Archived Article', status: 'archived' }
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

  it('handles edit for manual articles', () => {
    const isArticleManual = vi.fn().mockReturnValue(true);
    const paginatedArticles = [{ id: 1, title: 'Manual Article', status: 'new' }];
    renderComponent({ paginatedArticles, isArticleManual });
    
    const editBtn = screen.getByTitle('Editar Metadados');
    act(() => {
      fireEvent.click(editBtn);
    });
    
    expect(defaultProps.setEditingArticle).toHaveBeenCalledWith(paginatedArticles[0]);
  });

  it('handles citation', () => {
    const paginatedArticles = [{ id: 1, title: 'Article 1', status: 'new' }];
    renderComponent({ paginatedArticles });
    
    const citeBtn = screen.getByTitle('Gerar Citação');
    act(() => {
      fireEvent.click(citeBtn);
    });
    
    expect(defaultProps.setCitationArticle).toHaveBeenCalledWith(paginatedArticles[0]);
  });
});

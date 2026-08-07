import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArticleDetailsModal } from '../ArticleDetailsModal';
import { MemoryRouter } from 'react-router-dom';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';

const mockArticle: any = {
  id: 1,
  title: 'Test Article',
  is_oa: 1,
  search_id: 100,
  author_keywords: 'Key1; Key2',
  index_keywords: 'Index1; Index2',
  source_databases: '["Scopus", "PubMed"]',
  authors: 'John Doe',
  year: 2023,
  journal: 'Journal of Testing',
  volume: '1',
  issue: '2',
  pages: '3-4',
  document_type: 'Article',
  publisher: 'Test Publisher',
  citation_count: 5,
  doi: '10.1234/test',
  issn: '1234-5678',
  local_file_path: '/path/to/file.pdf',
  affiliations: 'Test University',
  abstract: 'This is a test abstract.',
  references_list: 'Ref 1; Ref 2',
};

const mockHistory = [
  { id: 100, unified_query: 'Busca de Teste' },
  { id: 101, unified_query: 'Importação de Teste' },
];

describe('ArticleDetailsModal', () => {
  let fakeService: FakeProjectService;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeService = FakeProjectService.create();
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  const renderModal = (props = {}) => {
    return render(
      <ServicesProvider apiService={fakeService}>
        <MemoryRouter>
          <ArticleDetailsModal
            isOpen={true}
            onClose={vi.fn()}
            article={mockArticle}
            history={mockHistory}
            {...props}
          />
        </MemoryRouter>
      </ServicesProvider>
    );
  };

  it('renders nothing if isOpen is false', () => {
    const { container } = renderModal({ isOpen: false });
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing if article is null', () => {
    const { container } = renderModal({ article: null });
    expect(container.firstChild).toBeNull();
  });

  it('renders article details correctly', () => {
    renderModal();
    expect(screen.getByText('Test Article')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('2023')).toBeInTheDocument();
    expect(screen.getByText('Journal of Testing')).toBeInTheDocument();
    expect(screen.getByText('v. 1, n. 2, p. 3-4')).toBeInTheDocument();
    expect(screen.getByText('Article')).toBeInTheDocument();
    expect(screen.getByText('Test Publisher')).toBeInTheDocument();
    expect(screen.getByText('🎓 5')).toBeInTheDocument();
    expect(screen.getByText('10.1234/test')).toBeInTheDocument();
    expect(screen.getByText('1234-5678')).toBeInTheDocument();
    expect(screen.getByText('Test University')).toBeInTheDocument();
    expect(screen.getByText('This is a test abstract.')).toBeInTheDocument();
    expect(screen.getByText('Scopus')).toBeInTheDocument();
    expect(screen.getByText('PubMed')).toBeInTheDocument();
    expect(screen.getByText('Acesso Aberto')).toBeInTheDocument();
    
    // Keywords
    expect(screen.getByText('Key1')).toBeInTheDocument();
    expect(screen.getByText('Key2')).toBeInTheDocument();
    expect(screen.getByText('Index1')).toBeInTheDocument();
    expect(screen.getByText('Index2')).toBeInTheDocument();

    // References
    expect(screen.getByText('Ref 1')).toBeInTheDocument();
    expect(screen.getByText('Ref 2')).toBeInTheDocument();
  });

  it('handles missing article fields gracefully', () => {
    const incompleteArticle = {
      id: 2,
      title: 'Incomplete Article',
      is_oa: 0, // Acesso Fechado
    };
    renderModal({ article: incompleteArticle });
    
    expect(screen.getByText('Incomplete Article')).toBeInTheDocument();
    expect(screen.getByText('Acesso Fechado')).toBeInTheDocument();
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
    expect(screen.getByText('Nenhum resumo disponível para este artigo.')).toBeInTheDocument();
    expect(screen.getByText('Cadastro Manual ⚠️')).toBeInTheDocument();
    expect(screen.getByText('🎓 0')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    const fecharButton = screen.getByText('Fechar');
    await act(async () => {
      fireEvent.click(fecharButton);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    
    const overlay = document.body.lastElementChild as Element;
    if (overlay) {
      await act(async () => {
         fireEvent.click(overlay);
      });
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('navigates to search when origin search button is clicked', async () => {
    const onNavigateToSearch = vi.fn();
    renderModal({ onNavigateToSearch });

    const searchButton = screen.getByText(/Busca #100/);
    await act(async () => {
      fireEvent.click(searchButton);
    });
    expect(onNavigateToSearch).toHaveBeenCalledWith(100);
  });

  it('shows Importação in origin if query starts with Importação', () => {
    renderModal({
      article: { ...mockArticle, search_id: 101 },
      history: mockHistory
    });
    expect(screen.getByText(/Importação #101/)).toBeInTheDocument();
  });

  it('shows missing history gracefully', () => {
    renderModal({
      article: { ...mockArticle, search_id: 999 }, // not in history
      history: mockHistory
    });
    expect(screen.getByText(/Busca #999 \(Histórico carregando...\)/)).toBeInTheDocument();
  });

  it('handles unlink pdf successfully', async () => {
    const onArticleUpdated = vi.fn();
    renderModal({ onArticleUpdated });

    const unlinkButton = screen.getByText('Desvincular PDF');
    await act(async () => {
      fireEvent.click(unlinkButton);
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(fakeService.unlinkPdf).toHaveBeenCalledWith(1);
    expect(onArticleUpdated).toHaveBeenCalled();
  });

  it('handles unlink pdf rejection', async () => {
    const onArticleUpdated = vi.fn();
    vi.spyOn(window, 'confirm').mockImplementation(() => false);
    renderModal({ onArticleUpdated });

    const unlinkButton = screen.getByText('Desvincular PDF');
    await act(async () => {
      fireEvent.click(unlinkButton);
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(fakeService.unlinkPdf).not.toHaveBeenCalled();
    expect(onArticleUpdated).not.toHaveBeenCalled();
  });

  it('handles unlink pdf error', async () => {
    fakeService.unlinkPdf.mockRejectedValueOnce(new Error('Network error'));
    renderModal();

    const unlinkButton = screen.getByText('Desvincular PDF');
    await act(async () => {
      fireEvent.click(unlinkButton);
    });

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Erro ao desvincular o PDF: Error: Network error'));
  });

  it('calls onAttachPdf when click attach pdf button', async () => {
    const onAttachPdf = vi.fn();
    renderModal({ 
      article: { ...mockArticle, local_file_path: null },
      onAttachPdf 
    });

    const attachButton = screen.getByText('Anexar PDF');
    await act(async () => {
      fireEvent.click(attachButton);
    });

    expect(onAttachPdf).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('parses databases correctly if it is not JSON', () => {
    renderModal({
      article: { ...mockArticle, source_databases: 'SingleDB' }
    });
    expect(screen.getByText('SingleDB')).toBeInTheDocument();
  });
  it('changes style on mouse enter and leave for origin search button', async () => {
    renderModal();

    const searchButton = screen.getByText(/Busca #100/);
    
    await act(async () => {
      fireEvent.mouseEnter(searchButton);
    });
    expect(searchButton.style.background).toBe('var(--color-primary)');
    expect(searchButton.style.color).toBe('white');

    await act(async () => {
      fireEvent.mouseLeave(searchButton);
    });
    expect(searchButton.style.background).toBe('rgba(79, 70, 229, 0.1)');
    expect(searchButton.style.color).toBe('var(--color-primary)');
  });
  it('parses databases correctly if it is already an array', () => {
    renderModal({
      article: { ...mockArticle, source_databases: ['ArrayDB'] }
    });
    expect(screen.getByText('ArrayDB')).toBeInTheDocument();
  });
});

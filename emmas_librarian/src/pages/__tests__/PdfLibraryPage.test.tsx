import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { PdfLibraryPage } from '../PdfLibraryPage';
import { ServicesContext } from '../../contexts/ServicesContext';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';

const fakeService = FakeProjectService.create();
const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as any,
    useNavigate: () => navigateMock,
  };
});

const renderPage = () => {
  return render(
    <BrowserRouter>
      <ServicesContext.Provider value={fakeService as any}>
        <PdfLibraryPage />
      </ServicesContext.Provider>
    </BrowserRouter>
  );
};

describe('PdfLibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeService.reset();
  });

  it('renders loading state initially', () => {
    fakeService.getStoredPdfs.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Carregando Biblioteca de PDFs...')).toBeInTheDocument();
  });

  it('renders correctly with no pdfs', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([]);
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Biblioteca Global de PDFs')).toBeInTheDocument();
    expect(screen.getByText('Nenhum arquivo PDF encontrado.')).toBeInTheDocument();
  });

  it('loads and displays pdfs with formatters', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([
      {
        id: 1,
        file_path: '/path/doc1.pdf',
        file_hash: 'hash1',
        filename: 'doc1.pdf',
        file_size: 1048576, // 1 MB
        created_at: '2023-01-01T12:00:00.000Z',
        articles: []
      },
      {
        id: 2,
        file_path: '/path/doc2.pdf',
        file_hash: 'hash2',
        filename: 'doc2.pdf',
        file_size: 0, // 0 bytes
        created_at: 'invalid-date', // invalid date fallback
        articles: [
          { article_id: 10, article_title: 'Title 10', project_id: 20, project_name: 'Project 20' },
          { article_id: 11, article_title: 'Title 11', project_id: 21, project_name: 'Project 21' }
        ]
      }
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('doc1.pdf')).toBeInTheDocument();
    expect(screen.getAllByText('1 MB')[0]).toBeInTheDocument();
    expect(screen.getByText('Órfão (Nenhum vínculo)')).toBeInTheDocument();

    expect(screen.getByText('doc2.pdf')).toBeInTheDocument();
    expect(screen.getByText('0 Bytes')).toBeInTheDocument();
    expect(screen.getByText('Invalid Date')).toBeInTheDocument();
    expect(screen.getByText('Utilizado em 2 artigos')).toBeInTheDocument();
    expect(screen.getByText('Title 10')).toBeInTheDocument();
    expect(screen.getByText('Project 20')).toBeInTheDocument();
  });

  it('filters pdfs by search term', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([
      {
        id: 1, file_path: '1', file_hash: '1', filename: 'apple.pdf', file_size: 1, created_at: '',
        articles: []
      },
      {
        id: 2, file_path: '2', file_hash: '2', filename: 'banana.pdf', file_size: 1, created_at: '',
        articles: [{ article_id: 1, article_title: 'cherry', project_id: 1, project_name: 'P1' }]
      }
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Pesquisar por nome do PDF/i);

    // Search for filename
    fireEvent.change(searchInput, { target: { value: 'apple' } });
    expect(screen.getByText('apple.pdf')).toBeInTheDocument();
    expect(screen.queryByText('banana.pdf')).not.toBeInTheDocument();

    // Search for article title
    fireEvent.change(searchInput, { target: { value: 'cherry' } });
    expect(screen.queryByText('apple.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('banana.pdf')).toBeInTheDocument();
  });

  it('handles upload direct pdf', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([]);
    fakeService.openPdfDialog.mockResolvedValue('/new/pdf.pdf');
    
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    const btn = screen.getByText('Adicionar PDF');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(fakeService.openPdfDialog).toHaveBeenCalled();
      expect(fakeService.uploadPdfToLibrary).toHaveBeenCalledWith('/new/pdf.pdf');
      expect(fakeService.getStoredPdfs).toHaveBeenCalledTimes(2); // reloaded
    });
  });

  it('handles upload direct pdf error', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([]);
    fakeService.openPdfDialog.mockRejectedValue(new Error('Dialog fail'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Adicionar PDF'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Erro ao realizar upload do PDF: Error: Dialog fail');
    });
    alertSpy.mockRestore();
  });

  it('handles delete pdf for orphan file', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([
      {
        id: 1, file_path: 'orphan.pdf', file_hash: '1', filename: 'orphan.pdf', file_size: 1, created_at: '',
        articles: []
      }
    ]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    const btnDelete = screen.getAllByTitle('Excluir PDF')[0];
    fireEvent.click(btnDelete);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Deseja excluir permanentemente este PDF do sistema? Esta ação não pode ser desfeita.');
      expect(fakeService.deletePdfLibraryRecord).toHaveBeenCalledWith('orphan.pdf');
      expect(fakeService.getStoredPdfs).toHaveBeenCalledTimes(2);
    });
    confirmSpy.mockRestore();
  });

  it('handles delete pdf for shared file', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([
      {
        id: 1, file_path: 'shared.pdf', file_hash: '1', filename: 'shared.pdf', file_size: 1, created_at: '',
        articles: [{ article_id: 1, article_title: 'A', project_id: 1, project_name: 'P' }]
      }
    ]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    const btnDelete = screen.getAllByTitle('Excluir PDF')[0];
    fireEvent.click(btnDelete);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Atenção: Este PDF está sendo usado em 1 artigo(s).'));
      expect(fakeService.deletePdfLibraryRecord).toHaveBeenCalledWith('shared.pdf');
    });
    confirmSpy.mockRestore();
  });

  it('handles delete pdf error', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([
      {
        id: 1, file_path: 'orphan.pdf', file_hash: '1', filename: 'orphan.pdf', file_size: 1, created_at: '',
        articles: []
      }
    ]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fakeService.deletePdfLibraryRecord.mockRejectedValue(new Error('Delete fail'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTitle('Excluir PDF')[0]);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Erro ao excluir PDF: Error: Delete fail');
    });
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('handles link modal open, load projects, and confirm link', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([
      {
        id: 1, file_path: 'link.pdf', file_hash: '1', filename: 'link.pdf', file_size: 1, created_at: '',
        articles: []
      }
    ]);
    
    fakeService.getProjects.mockResolvedValue([{ id: 100, name: 'Project 100', created_at: '' }]);
    fakeService.getArticles.mockResolvedValue([
      { id: 200, title: 'Article 200', local_file_path: undefined, project_id: 100, status: 'new' } as any, // eligible
      { id: 201, title: 'Article 201', local_file_path: 'other.pdf', project_id: 100, status: 'read' } as any // not eligible
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    // Open link modal
    fireEvent.click(screen.getAllByTitle('Vincular a outro Artigo')[0]);

    await waitFor(() => {
      expect(screen.getByText('Vincular PDF a um Artigo')).toBeInTheDocument();
    });
    
    expect(fakeService.getProjects).toHaveBeenCalled();
    
    // Select project
    const projectSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(projectSelect, { target: { value: '100' } });
    
    await waitFor(() => {
      expect(fakeService.getArticles).toHaveBeenCalledWith(100);
    });

    // Select article
    const articleSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(articleSelect, { target: { value: '200' } });

    // Confirm Link
    fireEvent.click(screen.getByText('Vincular PDF'));

    await waitFor(() => {
      expect(fakeService.linkPdfToArticle).toHaveBeenCalledWith(200, 'link.pdf');
      expect(screen.queryByText('Vincular PDF a um Artigo')).not.toBeInTheDocument(); // modal closed
    });
  });

  it('handles link modal with no eligible articles', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([
      {
        id: 1, file_path: 'link.pdf', file_hash: '1', filename: 'link.pdf', file_size: 1, created_at: '',
        articles: []
      }
    ]);
    
    fakeService.getProjects.mockResolvedValue([{ id: 100, name: 'Project 100', created_at: '' }]);
    fakeService.getArticles.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTitle('Vincular a outro Artigo')[0]);

    await waitFor(() => {
      expect(screen.getByText('Vincular PDF a um Artigo')).toBeInTheDocument();
    });
    
    const projectSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(projectSelect, { target: { value: '100' } });
    
    await waitFor(() => {
      expect(screen.getByText('Nenhum artigo sem PDF neste projeto.')).toBeInTheDocument();
    });
  });

  it('navigates to article reader and project', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([
      {
        id: 1, file_path: 'shared.pdf', file_hash: '1', filename: 'shared.pdf', file_size: 1, created_at: '',
        articles: [{ article_id: 99, article_title: 'A', project_id: 88, project_name: 'P' }]
      }
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    // navigate back
    fireEvent.click(screen.getByTitle('Voltar'));
    expect(navigateMock).toHaveBeenCalledWith('/');

    // navigate to article reader (button)
    fireEvent.click(screen.getAllByTitle('Visualizar no Leitor')[0]);
    expect(navigateMock).toHaveBeenCalledWith('/articles/99');

    // navigate to article (text)
    fireEvent.click(screen.getByText('A'));
    expect(navigateMock).toHaveBeenCalledWith('/articles/99');

    // navigate to project (text)
    fireEvent.click(screen.getByText(/Projeto:/).closest('span')!);
    expect(navigateMock).toHaveBeenCalledWith('/projects/88');
  });
});

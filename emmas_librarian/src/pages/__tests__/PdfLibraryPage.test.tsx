import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { PdfLibraryPage } from '../PdfLibraryPage';
import { FakeDialogs, FakeDialogsProvider } from '../../components/common/dialogs/__tests__/fakes/FakeDialogs';

let dialogs = new FakeDialogs();
import { ServicesContext } from '../../contexts/ServicesContext';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';

const fakeService = FakeProjectService.create();
const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...(actual as any),
    useNavigate: () => navigateMock,
  };
});

const renderPage = () => {
  return render(
    <BrowserRouter>
      <ServicesContext.Provider value={fakeService as any}>
        <FakeDialogsProvider dialogs={dialogs}>
          <PdfLibraryPage />
        </FakeDialogsProvider>
      </ServicesContext.Provider>
    </BrowserRouter>,
  );
};

/** Opens the first row's "Mais ações" menu and picks an item (board 171: the actions are out of the row). */
const pickFromMenu = async (title: string): Promise<HTMLElement> => {
  fireEvent.click((await screen.findAllByRole('button', { name: 'Mais ações' }))[0]);
  return (await screen.findAllByTitle(title))[0];
};

describe('PdfLibraryPage', () => {
  beforeEach(() => {
    dialogs = new FakeDialogs();
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

    expect(screen.getByRole('heading', { name: 'Biblioteca de PDFs' })).toBeInTheDocument();
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
        articles: [],
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
          { article_id: 11, article_title: 'Title 11', project_id: 21, project_name: 'Project 21' },
        ],
      },
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
        id: 1,
        file_path: '1',
        file_hash: '1',
        filename: 'apple.pdf',
        file_size: 1,
        created_at: '',
        articles: [],
      },
      {
        id: 2,
        file_path: '2',
        file_hash: '2',
        filename: 'banana.pdf',
        file_size: 1,
        created_at: '',
        articles: [{ article_id: 1, article_title: 'cherry', project_id: 1, project_name: 'P1' }],
      },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Nome do arquivo ou título/i);

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
    const alertSpy = dialogs.informMessage;

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Adicionar PDF'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Erro ao realizar upload do PDF: Error: Dialog fail');
    });
  });

  it('handles delete pdf for orphan file', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([
      {
        id: 1,
        file_path: 'orphan.pdf',
        file_hash: '1',
        filename: 'orphan.pdf',
        file_size: 1,
        created_at: '',
        articles: [],
      },
    ]);
    const confirmSpy = dialogs.confirmMessage;

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    const btnDelete = await pickFromMenu('Excluir PDF');
    fireEvent.click(btnDelete);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        'Deseja excluir permanentemente este PDF do sistema? Esta ação não pode ser desfeita.',
      );
      expect(fakeService.deletePdfLibraryRecord).toHaveBeenCalledWith('orphan.pdf');
      expect(fakeService.getStoredPdfs).toHaveBeenCalledTimes(2);
    });
  });

  it('handles delete pdf for shared file', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([
      {
        id: 1,
        file_path: 'shared.pdf',
        file_hash: '1',
        filename: 'shared.pdf',
        file_size: 1,
        created_at: '',
        articles: [{ article_id: 1, article_title: 'A', project_id: 1, project_name: 'P' }],
      },
    ]);
    const confirmSpy = dialogs.confirmMessage;

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    const btnDelete = await pickFromMenu('Excluir PDF');
    fireEvent.click(btnDelete);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('Atenção: Este PDF está sendo usado em 1 artigo(s).'),
      );
      expect(fakeService.deletePdfLibraryRecord).toHaveBeenCalledWith('shared.pdf');
    });
  });

  it('handles delete pdf error', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([
      {
        id: 1,
        file_path: 'orphan.pdf',
        file_hash: '1',
        filename: 'orphan.pdf',
        file_size: 1,
        created_at: '',
        articles: [],
      },
    ]);
    fakeService.deletePdfLibraryRecord.mockRejectedValue(new Error('Delete fail'));
    const alertSpy = dialogs.informMessage;

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    fireEvent.click(await pickFromMenu('Excluir PDF'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Erro ao excluir PDF: Error: Delete fail');
    });
  });

  it('handles link modal open, load projects, and confirm link', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([
      {
        id: 1,
        file_path: 'link.pdf',
        file_hash: '1',
        filename: 'link.pdf',
        file_size: 1,
        created_at: '',
        articles: [],
      },
    ]);

    fakeService.getProjects.mockResolvedValue([{ id: 100, name: 'Project 100', created_at: '' }]);
    fakeService.getArticles.mockResolvedValue([
      { id: 200, title: 'Article 200', local_file_path: undefined, project_id: 100, status: 'new' } as any, // eligible
      { id: 201, title: 'Article 201', local_file_path: 'other.pdf', project_id: 100, status: 'read' } as any, // not eligible
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    // Open link modal
    fireEvent.click(await pickFromMenu('Vincular a outro Artigo'));

    await waitFor(() => {
      expect(screen.getByText('Vincular PDF a um Artigo')).toBeInTheDocument();
    });

    expect(fakeService.getProjects).toHaveBeenCalled();

    // Select project
    const projectSelect = within(screen.getByRole('dialog')).getAllByRole('combobox')[0];
    fireEvent.change(projectSelect, { target: { value: '100' } });

    await waitFor(() => {
      expect(fakeService.getArticles).toHaveBeenCalledWith(100);
    });

    // Select article
    const articleSelect = within(screen.getByRole('dialog')).getAllByRole('combobox')[1];
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
        id: 1,
        file_path: 'link.pdf',
        file_hash: '1',
        filename: 'link.pdf',
        file_size: 1,
        created_at: '',
        articles: [],
      },
    ]);

    fakeService.getProjects.mockResolvedValue([{ id: 100, name: 'Project 100', created_at: '' }]);
    fakeService.getArticles.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    fireEvent.click(await pickFromMenu('Vincular a outro Artigo'));

    await waitFor(() => {
      expect(screen.getByText('Vincular PDF a um Artigo')).toBeInTheDocument();
    });

    const projectSelect = within(screen.getByRole('dialog')).getAllByRole('combobox')[0];
    fireEvent.change(projectSelect, { target: { value: '100' } });

    await waitFor(() => {
      expect(screen.getByText('Nenhum artigo sem PDF neste projeto.')).toBeInTheDocument();
    });
  });

  it('navigates to article reader and project', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([
      {
        id: 1,
        file_path: 'shared.pdf',
        file_hash: '1',
        filename: 'shared.pdf',
        file_size: 1,
        created_at: '',
        articles: [{ article_id: 99, article_title: 'A', project_id: 88, project_name: 'P' }],
      },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Carregando Biblioteca de PDFs...')).not.toBeInTheDocument();
    });

    // the title bar path replaces the back link (board 171)
    expect(screen.queryByRole('link', { name: 'Voltar aos projetos' })).not.toBeInTheDocument();

    // navigate to article reader (button)
    fireEvent.click(screen.getAllByRole('button', { name: 'Abrir' })[0]);
    expect(navigateMock).toHaveBeenCalledWith('/articles/99');

    // navigate to article (text)
    fireEvent.click(screen.getByText('A'));
    expect(navigateMock).toHaveBeenCalledWith('/articles/99');

    // navigate to project (text)
    fireEvent.click(screen.getByText(/Projeto:/).closest('span')!);
    expect(navigateMock).toHaveBeenCalledWith('/projects/88');
  });

  const ORPHAN = {
    id: 1,
    file_path: 'orphan.pdf',
    file_hash: 'h',
    filename: 'orphan.pdf',
    file_size: 1,
    created_at: '',
    articles: [],
  };

  // The answer is a promise (Arca 134): check only after the question was answered, or a missing check passes.
  it('keeps the PDF when the deletion is declined', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([ORPHAN]);
    dialogs.confirmMessage.mockReturnValue(false);
    renderPage();
    fireEvent.click(await pickFromMenu('Excluir PDF'));

    await waitFor(() => expect(dialogs.asked).toHaveLength(1));
    await act(async () => {});

    expect(fakeService.deletePdfLibraryRecord).not.toHaveBeenCalled();
  });

  it('tells a failed link in the app window', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([ORPHAN]);
    fakeService.getProjects.mockResolvedValue([{ id: 100, name: 'Project 100', created_at: '' }]);
    fakeService.getArticles.mockResolvedValue([
      { id: 200, title: 'Article 200', project_id: 100, status: 'new' } as never,
    ]);
    fakeService.linkPdfToArticle.mockRejectedValue('disco cheio');
    renderPage();
    fireEvent.click(await pickFromMenu('Vincular a outro Artigo'));
    fireEvent.change((await within(await screen.findByRole('dialog')).findAllByRole('combobox'))[0], {
      target: { value: '100' },
    });
    await waitFor(() => expect(within(screen.getByRole('dialog')).getAllByRole('combobox')).toHaveLength(2));
    fireEvent.change(within(screen.getByRole('dialog')).getAllByRole('combobox')[1], { target: { value: '200' } });

    fireEvent.click(screen.getByText('Vincular PDF'));

    await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith('Erro ao vincular PDF: disco cheio'));
  });

  it('narrows the table to the orphans and orders it by name', async () => {
    const pdf = (id: number, filename: string, size: number, linked: boolean) => ({
      id,
      file_path: filename,
      file_hash: String(id),
      filename,
      file_size: size,
      created_at: '2026-08-07T12:00:00',
      articles: linked ? [{ article_id: id, article_title: `T${id}`, project_id: 1, project_name: 'P' }] : [],
    });
    fakeService.getStoredPdfs.mockResolvedValue([
      pdf(1, 'b.pdf', 10, true),
      pdf(2, 'z.pdf', 99, false),
      pdf(3, 'a.pdf', 5, false),
    ]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Órfãos 2/ }));
    expect(screen.queryByText('b.pdf')).not.toBeInTheDocument();
    expect(screen.getAllByText(/\.pdf$/).map((el) => el.textContent)).toEqual(['z.pdf', 'a.pdf']);

    fireEvent.change(screen.getByLabelText(/Ordenar/), { target: { value: 'name' } });
    expect(screen.getAllByText(/\.pdf$/).map((el) => el.textContent)).toEqual(['a.pdf', 'z.pdf']);
  });
});

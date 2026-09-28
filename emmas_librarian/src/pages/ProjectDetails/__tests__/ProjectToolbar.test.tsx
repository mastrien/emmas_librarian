import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectToolbar } from '../components/ProjectToolbar';
import { MemoryRouter } from 'react-router-dom';
import { projectService } from '../../../services/api';

vi.mock('../../../services/api', async () => {
  const { FakeProjectService } = await import('../../../services/__tests__/fakes/FakeProjectService');
  return { projectService: FakeProjectService.create() };
});

describe('ProjectToolbar', () => {
  const defaultProps = {
    project: { id: 1 } as any,
    projectDocuments: [],
    setIsAIExtractionModalOpen: vi.fn(),
    isAddArticlesMenuOpen: false,
    setIsAddArticlesMenuOpen: vi.fn(),
    isExportMenuOpen: false,
    setIsExportMenuOpen: vi.fn(),
    handleBatchPdfImport: vi.fn(),
    setIsImportArticlesModalOpen: vi.fn(),
    setIsManualModalOpen: vi.fn(),
    setIsCategoriesModalOpen: vi.fn(),
    setIsQuickAccessModalOpen: vi.fn(),
    addArticlesMenuRef: { current: null },
    exportMenuRef: { current: null },
    handleAddMenuMouseEnter: vi.fn(),
    handleAddMenuMouseLeave: vi.fn(),
    handleExportMenuMouseEnter: vi.fn(),
    handleExportMenuMouseLeave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouter>
        <ProjectToolbar {...defaultProps} {...props} />
      </MemoryRouter>,
    );
  };

  it('renders all buttons', () => {
    renderComponent();
    expect(screen.getByText('Nova busca')).toBeInTheDocument();
    expect(screen.getByText('Extração IA')).toBeInTheDocument();
    expect(screen.getByText('Adicionar Artigos')).toBeInTheDocument();
    expect(screen.getByText('Exportar')).toBeInTheDocument();
    expect(screen.getByText('Criar categorias')).toBeInTheDocument();
    expect(screen.getByText('Acesso rápido')).toBeInTheDocument();
  });

  it('handles Extração IA click', () => {
    renderComponent();
    fireEvent.click(screen.getByText('Extração IA'));
    expect(defaultProps.setIsAIExtractionModalOpen).toHaveBeenCalledWith(true);
  });

  it('handles Adicionar Artigos click to open menu', () => {
    renderComponent();
    fireEvent.click(screen.getByText('Adicionar Artigos'));
    expect(defaultProps.setIsAddArticlesMenuOpen).toHaveBeenCalledWith(true);
  });

  it('renders and handles Adicionar Artigos dropdown items', () => {
    renderComponent({ isAddArticlesMenuOpen: true });

    // Batch import
    const batchImport = screen.getByText('Importar PDFs em Lote');
    act(() => {
      fireEvent.click(batchImport);
    });
    expect(defaultProps.setIsAddArticlesMenuOpen).toHaveBeenCalledWith(false);
    expect(defaultProps.handleBatchPdfImport).toHaveBeenCalled();

    // Import from project
    const importProject = screen.getByText('Importar de outro projeto');
    act(() => {
      fireEvent.click(importProject);
    });
    expect(defaultProps.setIsImportArticlesModalOpen).toHaveBeenCalledWith(true);

    // Manual Article
    const manualBtn = screen.getByText('Artigo Manual');
    act(() => {
      fireEvent.click(manualBtn);
    });
    expect(defaultProps.setIsManualModalOpen).toHaveBeenCalledWith(true);
  });

  it('handles Exportar click to open menu', () => {
    renderComponent();
    fireEvent.click(screen.getByText('Exportar'));
    expect(defaultProps.setIsExportMenuOpen).toHaveBeenCalledWith(true);
  });

  it('renders and handles Exportar dropdown items', async () => {
    renderComponent({ isExportMenuOpen: true });

    // Biblioshiny
    const biblio = screen.getByText('Biblioshiny');
    await act(async () => {
      fireEvent.click(biblio);
    });
    expect(defaultProps.setIsExportMenuOpen).toHaveBeenCalledWith(false);
    expect(projectService.exportBiblioshiny).toHaveBeenCalledWith(1);

    // .emmapcarc
    const packageBtn = screen.getByText('Pacote .emmapcarc (com PDFs)');
    await act(async () => {
      fireEvent.click(packageBtn);
    });
    expect(projectService.exportProject).toHaveBeenCalledWith(1);
  });

  // Both menu items used to fire and forget: no confirmation of where the file went, errors swallowed.
  describe.each([
    { item: 'Pacote .emmapcarc (com PDFs)', method: 'exportProject' as const, kind: 'Pacote .emmapcarc' },
    { item: 'Biblioshiny', method: 'exportBiblioshiny' as const, kind: 'CSV do Biblioshiny' },
  ])('export menu: $item', ({ item, method, kind }) => {
    let alertSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    });

    afterEach(() => {
      alertSpy.mockRestore();
    });

    it('tells where the file was saved', async () => {
      vi.mocked(projectService[method]).mockResolvedValueOnce('C:\\Exportados\\tese.file');
      renderComponent({ isExportMenuOpen: true });

      fireEvent.click(screen.getByText(item));

      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith(`${kind} exportado com sucesso para: C:\\Exportados\\tese.file`),
      );
    });

    it('reports a failed export', async () => {
      vi.mocked(projectService[method]).mockRejectedValueOnce(new Error('disco cheio'));
      renderComponent({ isExportMenuOpen: true });

      fireEvent.click(screen.getByText(item));

      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(`Erro ao exportar ${kind}: disco cheio`));
    });

    it('stays quiet when the save dialog is cancelled', async () => {
      vi.mocked(projectService[method]).mockResolvedValueOnce(null);
      renderComponent({ isExportMenuOpen: true });

      fireEvent.click(screen.getByText(item));

      await waitFor(() => expect(projectService[method]).toHaveBeenCalledWith(1));
      expect(alertSpy).not.toHaveBeenCalled();
    });
  });

  it('handles Criar categorias click', () => {
    renderComponent();
    fireEvent.click(screen.getByText('Criar categorias'));
    expect(defaultProps.setIsCategoriesModalOpen).toHaveBeenCalledWith(true);
  });

  it('handles quick access modal open', () => {
    renderComponent();
    const settingsBtn = screen.getByTitle('Gerenciar acessos rápidos');
    fireEvent.click(settingsBtn);
    expect(defaultProps.setIsQuickAccessModalOpen).toHaveBeenCalledWith(true);
  });

  it('renders empty quick access state', () => {
    renderComponent();
    expect(
      screen.getByText('Nenhum link ou documento cadastrado. Clique na engrenagem para adicionar.'),
    ).toBeInTheDocument();
  });

  it('renders and handles quick access documents', () => {
    const projectDocuments = [
      { id: 1, project_id: 1, created_at: '', title: 'Google', url: 'https://google.com', category: 'General' },
      { id: 2, project_id: 1, created_at: '', title: 'Local File', local_file_path: '/local/file.pdf', category: '' },
    ];

    renderComponent({ projectDocuments });

    expect(screen.getByText('General')).toBeInTheDocument();

    const googleBtn = screen.getByText('Google');
    act(() => {
      fireEvent.click(googleBtn);
    });
    expect(projectService.openProjectDocumentExternal).toHaveBeenCalledWith('https://google.com', undefined);

    const localBtn = screen.getByText('Local File');
    act(() => {
      fireEvent.click(localBtn);
    });
    expect(projectService.openProjectDocumentExternal).toHaveBeenCalledWith(undefined, '/local/file.pdf');
  });
});

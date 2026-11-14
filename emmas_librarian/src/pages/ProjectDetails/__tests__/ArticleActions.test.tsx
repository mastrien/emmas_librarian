import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArticleActions } from '../components/ArticleActions';
import { MemoryRouter } from 'react-router-dom';
import { projectService } from '../../../services/api';
import { FakeDialogs, withFakeDialogs } from '../../../components/common/dialogs/__tests__/fakes/FakeDialogs';

let dialogs = new FakeDialogs();
beforeEach(() => {
  dialogs = new FakeDialogs();
});

vi.mock('../../../services/api', async () => {
  const { FakeProjectService } = await import('../../../services/__tests__/fakes/FakeProjectService');
  return { projectService: FakeProjectService.create() };
});

describe('ArticleActions', () => {
  const defaultProps = {
    projectId: 1,
    isAddArticlesMenuOpen: false,
    setIsAddArticlesMenuOpen: vi.fn(),
    isExportMenuOpen: false,
    setIsExportMenuOpen: vi.fn(),
    handleBatchPdfImport: vi.fn(),
    setIsImportArticlesModalOpen: vi.fn(),
    setIsManualModalOpen: vi.fn(),
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
        <ArticleActions {...defaultProps} {...props} />
      </MemoryRouter>,
      { wrapper: withFakeDialogs(dialogs) },
    );
  };

  // Board 153: Exportar first, then the screen's one primary button.
  it('shows Exportar, then Adicionar artigos as the primary button', () => {
    renderComponent();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Exportar', 'Adicionar artigos']);
    expect(buttons[1]).toHaveClass('btn-primary');
  });

  // Redesign board 153: search, investigation and review moved to the project sidebar (tested with the Layout).
  it('leaves the links to other project screens to the sidebar', () => {
    renderComponent();
    expect(screen.queryByRole('link', { name: /Nova busca|Investigação com IA|Revisão sistemática/ })).toBeNull();
  });

  it('handles Adicionar artigos click to open menu', () => {
    renderComponent();
    fireEvent.click(screen.getByText('Adicionar artigos'));
    expect(defaultProps.setIsAddArticlesMenuOpen).toHaveBeenCalledWith(true);
  });

  it('renders and handles Adicionar artigos dropdown items', () => {
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
    it('tells where the file was saved', async () => {
      vi.mocked(projectService[method]).mockResolvedValueOnce('C:\\Exportados\\tese.file');
      renderComponent({ isExportMenuOpen: true });

      fireEvent.click(screen.getByText(item));

      await waitFor(() =>
        expect(dialogs.informMessage).toHaveBeenCalledWith(
          `${kind} exportado com sucesso para: C:\\Exportados\\tese.file`,
        ),
      );
    });

    it('reports a failed export', async () => {
      vi.mocked(projectService[method]).mockRejectedValueOnce(new Error('disco cheio'));
      renderComponent({ isExportMenuOpen: true });

      fireEvent.click(screen.getByText(item));

      await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith(`Erro ao exportar ${kind}: disco cheio`));
    });

    it('stays quiet when the save dialog is cancelled', async () => {
      vi.mocked(projectService[method]).mockResolvedValueOnce(null);
      renderComponent({ isExportMenuOpen: true });

      fireEvent.click(screen.getByText(item));

      await waitFor(() => expect(projectService[method]).toHaveBeenCalledWith(1));
      expect(dialogs.informMessage).not.toHaveBeenCalled();
    });
  });
});

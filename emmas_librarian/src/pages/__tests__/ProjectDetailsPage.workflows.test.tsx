import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within, createEvent } from '@testing-library/react';
import { givenProject, renderProjectPage, article, mainTable } from './support/projectPageHarness';

afterEach(() => vi.restoreAllMocks());

const openAddMenu = () => fireEvent.click(screen.getByRole('button', { name: /Adicionar artigos/ }));
const container = () => screen.getByTestId('project-details-container');
const pdf = (name: string) => new File(['%PDF'], name, { type: 'application/pdf' });
// "Editar Metadados" lives in the row's "⋯" menu.
const openEditMetadata = () => {
  fireEvent.click(within(mainTable()).getByRole('button', { name: 'Mais ações' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Editar Metadados' }));
};

function dropFiles(files: File[]): void {
  const drop = createEvent.drop(container());
  Object.defineProperty(drop, 'dataTransfer', { value: { files, types: ['Files'] } });
  fireEvent(container(), drop);
}

function dragOverWith(types: string[]): void {
  const over = createEvent.dragOver(container());
  Object.defineProperty(over, 'dataTransfer', { value: { types } });
  fireEvent(container(), over);
}

describe('ProjectDetailsPage batch PDF import', () => {
  it('imports the selected PDFs, reports the count and reloads', async () => {
    const service = givenProject();
    service.openMultiplePdfsDialog.mockResolvedValue(['/in/a.pdf', '/in/b.pdf']);
    service.createArticlesFromPdfs.mockResolvedValue(2);
    const dialogs = await renderProjectPage(service);

    openAddMenu();
    fireEvent.click(screen.getByRole('button', { name: /Importar PDFs em Lote/ }));

    await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith('2 artigo(s) importado(s) com sucesso.'));
    expect(service.createArticlesFromPdfs).toHaveBeenCalledWith(1, ['/in/a.pdf', '/in/b.pdf']);
    await waitFor(() => expect(service.getArticles).toHaveBeenCalledTimes(2));
  });

  it.each([
    ['cancelled', null],
    ['empty', []],
  ])('does nothing when the dialog is %s', async (_label, selection) => {
    const service = givenProject();
    service.openMultiplePdfsDialog.mockResolvedValue(selection as never);
    const dialogs = await renderProjectPage(service);

    openAddMenu();
    fireEvent.click(screen.getByRole('button', { name: /Importar PDFs em Lote/ }));

    await waitFor(() => expect(service.openMultiplePdfsDialog).toHaveBeenCalled());
    expect(service.createArticlesFromPdfs).not.toHaveBeenCalled();
    expect(dialogs.informMessage).not.toHaveBeenCalled();
  });

  it('alerts when the import fails', async () => {
    const service = givenProject();
    service.openMultiplePdfsDialog.mockResolvedValue(['/in/a.pdf']);
    service.createArticlesFromPdfs.mockRejectedValue(new Error('disk full'));
    const dialogs = await renderProjectPage(service);

    openAddMenu();
    fireEvent.click(screen.getByRole('button', { name: /Importar PDFs em Lote/ }));

    await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith('Erro ao importar PDFs: disk full'));
  });
});

describe('ProjectDetailsPage drag and drop', () => {
  it('shows the drop overlay only for file drags', async () => {
    await renderProjectPage(givenProject());

    dragOverWith(['text/plain']);
    expect(screen.queryByText('Solte seus PDFs aqui para importar')).not.toBeInTheDocument();

    dragOverWith(['Files']);
    expect(screen.getByText('Solte seus PDFs aqui para importar')).toBeInTheDocument();
  });

  it('keeps the overlay while dragging over children and hides it when leaving the page', async () => {
    await renderProjectPage(givenProject());
    const child = container().appendChild(document.createElement('div'));
    const leaveTowards = (relatedTarget: Node | null) => {
      const leave = createEvent.dragLeave(container());
      Object.defineProperty(leave, 'relatedTarget', { value: relatedTarget });
      fireEvent(container(), leave);
    };
    dragOverWith(['Files']);

    leaveTowards(child);
    expect(screen.getByText('Solte seus PDFs aqui para importar')).toBeInTheDocument();

    leaveTowards(document.body);
    expect(screen.queryByText('Solte seus PDFs aqui para importar')).not.toBeInTheDocument();

    dragOverWith([]);
    leaveTowards(null);
    expect(screen.queryByText('Solte seus PDFs aqui para importar')).not.toBeInTheDocument();
  });

  it('imports dropped PDFs by their filesystem path and ignores other files', async () => {
    vi.spyOn(window.electronAPI, 'getPathForFile').mockImplementation((file) => `/dropped/${file.name}`);
    const service = givenProject();
    service.createArticlesFromPdfs.mockResolvedValue(1);
    const dialogs = await renderProjectPage(service);
    dragOverWith(['Files']);

    dropFiles([pdf('paper.PDF'), new File(['x'], 'notes.txt')]);

    await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith('1 artigo(s) importado(s) com sucesso.'));
    expect(service.createArticlesFromPdfs).toHaveBeenCalledWith(1, ['/dropped/paper.PDF']);
    expect(screen.queryByText('Solte seus PDFs aqui para importar')).not.toBeInTheDocument();
  });

  it('falls back to the file name when the bridge cannot resolve paths', async () => {
    const bridge = window.electronAPI;
    window.electronAPI = { ...bridge, getPathForFile: undefined as unknown as typeof bridge.getPathForFile };
    const service = givenProject();
    service.createArticlesFromPdfs.mockResolvedValue(1);
    await renderProjectPage(service);

    dropFiles([pdf('a.pdf')]);

    await waitFor(() => expect(service.createArticlesFromPdfs).toHaveBeenCalledWith(1, ['a.pdf']));
    window.electronAPI = bridge;
  });

  it('ignores drops without PDFs', async () => {
    const service = givenProject();
    await renderProjectPage(service);

    dropFiles([new File(['x'], 'notes.txt')]);

    expect(service.createArticlesFromPdfs).not.toHaveBeenCalled();
  });

  it('alerts when a dropped import fails', async () => {
    const service = givenProject();
    service.createArticlesFromPdfs.mockRejectedValue('offline');
    const dialogs = await renderProjectPage(service);

    dropFiles([pdf('a.pdf')]);

    await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith('Erro ao importar PDFs: offline'));
  });
});

describe('ProjectDetailsPage article forms', () => {
  it('creates a manual article and reloads', async () => {
    const service = givenProject();
    await renderProjectPage(service);

    openAddMenu();
    fireEvent.click(screen.getByRole('button', { name: /Artigo Manual/ }));
    fireEvent.change(screen.getByPlaceholderText('Ex: A New Approach to Bibliometrics'), {
      target: { value: 'Manual' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Artigo/ }));

    await waitFor(() =>
      expect(service.createManualArticle).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: 'Manual' }),
        undefined,
      ),
    );
    await waitFor(() => expect(service.getArticles).toHaveBeenCalledTimes(2));
  });

  it('edits a manual article and reloads', async () => {
    const service = givenProject([article({ id: 8, title: 'Avulso', source_databases: '["Manual"]' })]);
    await renderProjectPage(service);

    openEditMetadata();
    fireEvent.change(screen.getByDisplayValue('Avulso'), { target: { value: 'Avulso revisado' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/ }));

    await waitFor(() =>
      expect(service.updateArticleMetadata).toHaveBeenCalledWith(
        8,
        expect.objectContaining({ title: 'Avulso revisado' }),
      ),
    );
    await waitFor(() => expect(service.getArticles).toHaveBeenCalledTimes(2));
  });

  it('treats a legacy bare source value as a single source instead of crashing the page', async () => {
    await renderProjectPage(givenProject([article({ id: 8, title: 'Legado', source_databases: 'Manual' })]));

    // The compact base badge says "Manual" and carries the warning for screen readers and the tooltip.
    expect(within(mainTable()).getAllByLabelText(/adicionados manualmente/)).toHaveLength(1);
    fireEvent.click(within(mainTable()).getByRole('button', { name: 'Mais ações' }));
    expect(screen.getByRole('menuitem', { name: 'Editar Metadados' })).toBeInTheDocument();
  });

  // Search results can come back with incomplete metadata too, so editing is not limited to manual articles.
  it('edits the metadata of an article that came from a search', async () => {
    const service = givenProject([article({ id: 9, title: 'Importado', source_databases: '["Scopus"]' })]);
    await renderProjectPage(service);

    openEditMetadata();
    fireEvent.change(screen.getByDisplayValue('Importado'), { target: { value: 'Importado corrigido' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/ }));

    await waitFor(() =>
      expect(service.updateArticleMetadata).toHaveBeenCalledWith(
        9,
        expect.objectContaining({ title: 'Importado corrigido' }),
      ),
    );
    await waitFor(() => expect(service.getArticles).toHaveBeenCalledTimes(2));
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportArticlesModal } from '../modals/ImportArticlesModal';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';
import type { Article } from '../../types';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {},
}));

describe('ImportArticlesModal', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    fakeService.getProjects.mockResolvedValue([
      { id: 1, name: 'Destino', created_at: '' },
      { id: 2, name: 'Origem', created_at: '' },
    ]);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ImportArticlesModal isOpen={false} destProjectId={1} onClose={vi.fn()} onImportComplete={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('offers every other project as a source, excluding the destination', async () => {
    render(<ImportArticlesModal isOpen={true} destProjectId={1} onClose={vi.fn()} onImportComplete={vi.fn()} />);

    expect(screen.getByText('Importar Artigos de Outro Projeto')).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Origem' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '-- Selecione o projeto de origem --' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Destino' })).not.toBeInTheDocument();
  });

  it('renders its content when opened after rendering closed', async () => {
    const modal = (isOpen: boolean) => (
      <ImportArticlesModal isOpen={isOpen} destProjectId={1} onClose={vi.fn()} onImportComplete={vi.fn()} />
    );
    const { rerender } = render(modal(false));

    rerender(modal(true));

    expect(screen.getByText('Importar Artigos de Outro Projeto')).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Origem' })).toBeInTheDocument();
  });
});

describe('ImportArticlesModal copying articles', () => {
  const article = (id: number, title: string, authors = 'Silva, A.') =>
    ({ id, project_id: 2, title, authors, status: 'new' }) as Article;

  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    fakeService.getProjects.mockResolvedValue([
      { id: 1, name: 'Destino', created_at: '' },
      { id: 2, name: 'Origem', created_at: '' },
    ]);
    fakeService.getArticles.mockResolvedValue([
      article(10, 'Redes neurais'),
      article(11, 'Aprendizado profundo'),
      article(12, 'Revisão sistemática', 'Souza, B.'),
    ]);
  });

  const openWithSource = async (handlers = { onClose: vi.fn(), onImportComplete: vi.fn() }) => {
    render(<ImportArticlesModal isOpen destProjectId={1} {...handlers} />);
    await screen.findByRole('option', { name: 'Origem' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
    await screen.findByText('Redes neurais');
    return handlers;
  };
  const confirm = () => screen.getByRole('button', { name: 'Confirmar Importação' });

  it('copies the chosen articles into the destination project, then closes', async () => {
    const { onClose, onImportComplete } = await openWithSource();

    fireEvent.click(screen.getByText('Redes neurais'));
    fireEvent.click(screen.getByText('Revisão sistemática'));
    fireEvent.click(confirm());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fakeService.getArticles).toHaveBeenCalledWith(2);
    expect(fakeService.importArticlesFromProject).toHaveBeenCalledWith(2, 1, [10, 12]);
    expect(onImportComplete).toHaveBeenCalled();
  });

  it('keeps "Confirmar Importação" disabled until an article is selected', async () => {
    await openWithSource();
    expect(confirm()).toBeDisabled();

    fireEvent.click(screen.getByText('Aprendizado profundo'));

    expect(confirm()).toBeEnabled();
    expect(screen.getByText('artigo(s) selecionado(s) para cópia.').parentElement).toHaveTextContent('1 artigo(s)');
  });

  it('selects only the articles the search leaves when selecting all filtered', async () => {
    await openWithSource();

    fireEvent.change(screen.getByPlaceholderText('Pesquisar artigos no projeto de origem...'), {
      target: { value: 'souza' },
    });
    fireEvent.click(screen.getByText('Selecionar Todos Filtrados'));
    fireEvent.click(confirm());

    await waitFor(() => expect(fakeService.importArticlesFromProject).toHaveBeenCalledWith(2, 1, [12]));
  });

  it('alerts and stays open when the copy fails', async () => {
    fakeService.importArticlesFromProject.mockRejectedValue(new Error('projeto removido'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { onClose, onImportComplete } = await openWithSource();

    fireEvent.click(screen.getByText('Redes neurais'));
    fireEvent.click(confirm());

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Erro ao importar artigos: Error: projeto removido'));
    expect(onClose).not.toHaveBeenCalled();
    expect(onImportComplete).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

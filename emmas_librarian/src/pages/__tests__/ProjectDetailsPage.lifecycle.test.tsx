import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProjectDetailsPage } from '../ProjectDetailsPage';
import { ServicesProvider } from '../../contexts/ServicesContext';
import { GlobalErrorProvider } from '../../contexts/GlobalErrorContext';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { FakeDialogsProvider } from '../../components/common/dialogs/__tests__/fakes/FakeDialogs';
import { givenProject, renderProjectPage, article, PROJECT } from './support/projectPageHarness';
import type { SearchHistoryItem } from '../../types';

afterEach(() => vi.restoreAllMocks());

const heading = () => screen.getByRole('heading', { level: 1 });
const renameButton = () => heading().nextElementSibling as HTMLElement;
const deleteButton = () => renameButton().nextElementSibling as HTMLElement;

describe('ProjectDetailsPage loading', () => {
  it('shows a skeleton until the project loads', async () => {
    const service = givenProject();
    let release: () => void = () => undefined;
    service.getProject.mockImplementation(() => new Promise((resolve) => (release = () => resolve(PROJECT))));
    render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <ServicesProvider apiService={service}>
          <GlobalErrorProvider>
            <FakeDialogsProvider>
              <Routes>
                <Route path="/projects/:id" element={<ProjectDetailsPage />} />
              </Routes>
            </FakeDialogsProvider>
          </GlobalErrorProvider>
        </ServicesProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Voltar aos projetos' })).toBeInTheDocument();
    expect(screen.queryByTestId('project-details-container')).not.toBeInTheDocument();
    release();
    expect(await screen.findByRole('heading', { name: 'Tese' })).toBeInTheDocument();
  });

  it('loads every data source for the project id in the URL', async () => {
    const service = givenProject();

    await renderProjectPage(service);

    for (const method of [
      'getProject',
      'getArticles',
      'getSearchHistory',
      'getProjectDocuments',
      'getProjectCategories',
      'getAllProjectArticleCategories',
    ] as const) {
      expect(service[method]).toHaveBeenCalledWith(1);
    }
  });

  it('reports a missing project', async () => {
    const service = FakeProjectService.create();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.getProject.mockRejectedValue(new Error('not found'));
    render(
      <MemoryRouter initialEntries={['/projects/9']}>
        <ServicesProvider apiService={service}>
          <GlobalErrorProvider>
            <FakeDialogsProvider>
              <Routes>
                <Route path="/projects/:id" element={<ProjectDetailsPage />} />
              </Routes>
            </FakeDialogsProvider>
          </GlobalErrorProvider>
        </ServicesProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Projeto não encontrado.')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith('Erro ao carregar dados do projeto', expect.any(Error));
  });
});

describe('ProjectDetailsPage tabs', () => {
  it('labels tabs with article and history counts and starts on articles', async () => {
    const service = givenProject([article({ id: 1 }), article({ id: 2 })]);
    service.getSearchHistory.mockResolvedValue([{ id: 1 } as SearchHistoryItem]);

    await renderProjectPage(service);

    expect(screen.getByTestId('tab-articles')).toHaveTextContent('Artigos (2)');
    expect(screen.getByTestId('tab-history')).toHaveTextContent('Histórico (1)');
    expect(screen.getByTestId('main-articles-table')).toBeInTheDocument();
  });

  it('switches between tab contents', async () => {
    await renderProjectPage(givenProject([article({ id: 1 })]));

    fireEvent.click(screen.getByTestId('tab-overview'));
    expect(await screen.findByText('Status dos Artigos')).toBeInTheDocument();
    expect(screen.queryByTestId('main-articles-table')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-diary'));
    expect(await screen.findByRole('button', { name: /Página de Hoje/ })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-articles'));
    expect(screen.getByTestId('main-articles-table')).toBeInTheDocument();
  });

  it('highlights the active tab', async () => {
    await renderProjectPage(givenProject());

    fireEvent.click(screen.getByTestId('tab-overview'));

    // The highlight is the is-active class of projectPage.css now (Arca 134).
    expect(screen.getByTestId('tab-overview')).toHaveClass('is-active');
    expect(screen.getByTestId('tab-articles')).not.toHaveClass('is-active');
  });
});

describe('ProjectDetailsPage search history', () => {
  const entry = {
    id: 5,
    unified_query: 'machine learning',
    translated_queries: '{}',
    results_breakdown: '{}',
    total_results: 3,
    created_at: '2026-01-01T00:00:00Z',
  };

  it('reverts a search and reloads the project', async () => {
    const service = givenProject();
    service.getSearchHistory.mockResolvedValue([entry]);
    await renderProjectPage(service);
    fireEvent.click(screen.getByTestId('tab-history'));

    fireEvent.click(await screen.findByRole('button', { name: /Desfazer Busca/ }));

    await waitFor(() => expect(service.revertSearch).toHaveBeenCalledWith(5));
    await waitFor(() => expect(service.getArticles).toHaveBeenCalledTimes(2));
  });

  it('alerts when reverting fails', async () => {
    const service = givenProject();
    service.getSearchHistory.mockResolvedValue([entry]);
    service.revertSearch.mockRejectedValue(new Error('locked'));
    const dialogs = await renderProjectPage(service);
    fireEvent.click(screen.getByTestId('tab-history'));

    fireEvent.click(await screen.findByRole('button', { name: /Desfazer Busca/ }));

    await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith('Erro ao desfazer a busca'));
  });
});

describe('ProjectDetailsPage rename', () => {
  it('saves a trimmed new name', async () => {
    const service = givenProject();
    await renderProjectPage(service);

    fireEvent.click(renameButton());
    const input = screen.getByDisplayValue('Tese');
    fireEvent.change(input, { target: { value: '  Dissertação ' } });
    fireEvent.click(input.nextElementSibling as HTMLElement);

    expect(await screen.findByRole('heading', { name: 'Dissertação' })).toBeInTheDocument();
    expect(service.updateProject).toHaveBeenCalledWith(1, 'Dissertação');
  });

  it('ignores a blank name', async () => {
    const service = givenProject();
    await renderProjectPage(service);

    fireEvent.click(renameButton());
    const input = screen.getByDisplayValue('Tese');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(input.nextElementSibling as HTMLElement);

    expect(service.updateProject).not.toHaveBeenCalled();
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('   ');
  });

  it('cancels editing and restores the original name', async () => {
    await renderProjectPage(givenProject());

    fireEvent.click(renameButton());
    const input = screen.getByDisplayValue('Tese');
    fireEvent.change(input, { target: { value: 'Outro' } });
    fireEvent.click((input.nextElementSibling as HTMLElement).nextElementSibling as HTMLElement);
    fireEvent.click(renameButton());

    expect(screen.getByDisplayValue('Tese')).toBeInTheDocument();
  });

  it('alerts when the rename fails and keeps editing', async () => {
    const service = givenProject();
    service.updateProject.mockRejectedValue(new Error('dup'));
    const dialogs = await renderProjectPage(service);

    fireEvent.click(renameButton());
    fireEvent.change(screen.getByDisplayValue('Tese'), { target: { value: 'X' } });
    fireEvent.click(screen.getByDisplayValue('X').nextElementSibling as HTMLElement);

    await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith('Erro ao atualizar nome do projeto'));
    expect(screen.getByDisplayValue('X')).toBeInTheDocument();
  });
});

describe('ProjectDetailsPage delete', () => {
  it('deletes after confirmation and returns to the project list', async () => {
    const service = givenProject();
    const dialogs = await renderProjectPage(service);

    fireEvent.click(deleteButton());

    expect(await screen.findByText('Lista de projetos')).toBeInTheDocument();
    expect(dialogs.confirmMessage.mock.calls[0][0]).toContain('excluir o projeto "Tese"');
    expect(service.deleteProject).toHaveBeenCalledWith(1);
  });

  it('keeps the project when the user declines', async () => {
    const service = givenProject();
    const dialogs = await renderProjectPage(service);
    dialogs.confirmMessage.mockReturnValue(false);

    fireEvent.click(deleteButton());

    expect(service.deleteProject).not.toHaveBeenCalled();
    expect(
      within(screen.getByTestId('project-details-container')).getByRole('heading', { level: 1 }),
    ).toHaveTextContent('Tese');
  });

  it('alerts when deletion fails', async () => {
    const service = givenProject();
    service.deleteProject.mockRejectedValue(new Error('locked'));
    const dialogs = await renderProjectPage(service);

    fireEvent.click(deleteButton());

    await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith('Erro ao excluir projeto'));
    expect(screen.queryByText('Lista de projetos')).not.toBeInTheDocument();
  });
});

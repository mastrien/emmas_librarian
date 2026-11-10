import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProjectDetailsPage } from '../ProjectDetailsPage';
import { ServicesProvider } from '../../contexts/ServicesContext';
import { GlobalErrorProvider } from '../../contexts/GlobalErrorContext';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { FakeDialogsProvider } from '../../components/common/dialogs/__tests__/fakes/FakeDialogs';
import { givenProject, renderProjectPage, article, PROJECT } from './support/projectPageHarness';

// The overview's markdown editor runs on contentEditable, which jsdom cannot drive (see FakeMdxEditor).
vi.mock(
  '@mdxeditor/editor',
  async () => (await import('../../components/__tests__/fakes/FakeMdxEditor')).fakeMdxEditorModule,
);
vi.mock('@mdxeditor/editor/style.css', () => ({}));

afterEach(() => vi.restoreAllMocks());

// Rename and delete live on the overview header since the redesign (board 154).
const OVERVIEW = '/projects/1/overview';
const renameButton = () => screen.getByRole('button', { name: 'Renomear projeto' });
const deleteButton = () => screen.getByRole('button', { name: 'Excluir projeto' });
const saveNameButton = () => screen.getByRole('button', { name: 'Salvar nome' });

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
                <Route path="/projects/:id/:section" element={<ProjectDetailsPage />} />
              </Routes>
            </FakeDialogsProvider>
          </GlobalErrorProvider>
        </ServicesProvider>
      </MemoryRouter>,
    );

    expect(document.querySelector('.skeleton-block')).not.toBeNull();
    expect(screen.queryByTestId('project-details-container')).not.toBeInTheDocument();
    release();
    expect(await screen.findByRole('heading', { name: 'Artigos' })).toBeInTheDocument();
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
                <Route path="/projects/:id/:section" element={<ProjectDetailsPage />} />
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

describe('ProjectDetailsPage sections', () => {
  afterEach(() => sessionStorage.clear());

  it('opens the articles section on a first visit to the project', async () => {
    await renderProjectPage(givenProject([article({ id: 1 })]));

    expect(screen.getByTestId('main-articles-table')).toBeInTheDocument();
  });

  it('shows the section named in the URL', async () => {
    await renderProjectPage(givenProject([article({ id: 1 })]), '/projects/1/overview');

    expect(await screen.findByRole('heading', { name: 'Sobre o projeto' })).toBeInTheDocument();
    expect(screen.queryByTestId('main-articles-table')).not.toBeInTheDocument();
  });

  it('shows the diary section', async () => {
    await renderProjectPage(givenProject(), '/projects/1/diary');

    expect(await screen.findByRole('navigation', { name: 'Páginas do diário' })).toBeInTheDocument();
  });

  // The sidebar links to sections; coming back to /projects/:id must reopen the one the user left.
  it('reopens the last section of the session on the bare project path', async () => {
    sessionStorage.setItem('project.1.view.activeTab', JSON.stringify('overview'));

    await renderProjectPage(givenProject([article({ id: 1 })]));

    expect(await screen.findByRole('heading', { name: 'Sobre o projeto' })).toBeInTheDocument();
  });

  it('remembers the section shown in the URL for the next visit', async () => {
    await renderProjectPage(givenProject(), '/projects/1/diary');

    expect(JSON.parse(sessionStorage.getItem('project.1.view.activeTab') ?? 'null')).toBe('diary');
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
    await renderProjectPage(service, '/projects/1/history');

    fireEvent.click(await screen.findByRole('button', { name: /Desfazer Busca/ }));

    await waitFor(() => expect(service.revertSearch).toHaveBeenCalledWith(5));
    await waitFor(() => expect(service.getArticles).toHaveBeenCalledTimes(2));
  });

  it('alerts when reverting fails', async () => {
    const service = givenProject();
    service.getSearchHistory.mockResolvedValue([entry]);
    service.revertSearch.mockRejectedValue(new Error('locked'));
    const dialogs = await renderProjectPage(service, '/projects/1/history');

    fireEvent.click(await screen.findByRole('button', { name: /Desfazer Busca/ }));

    await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith('Erro ao desfazer a busca'));
  });
});

describe('ProjectDetailsPage rename', () => {
  it('saves a trimmed new name', async () => {
    const service = givenProject();
    await renderProjectPage(service, OVERVIEW);

    fireEvent.click(renameButton());
    const input = screen.getByDisplayValue('Tese');
    fireEvent.change(input, { target: { value: '  Dissertação ' } });
    fireEvent.click(saveNameButton());

    expect(await screen.findByRole('heading', { name: 'Dissertação' })).toBeInTheDocument();
    expect(service.updateProject).toHaveBeenCalledWith(1, 'Dissertação');
  });

  it('ignores a blank name', async () => {
    const service = givenProject();
    await renderProjectPage(service, OVERVIEW);

    fireEvent.click(renameButton());
    const input = screen.getByDisplayValue('Tese');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(saveNameButton());

    expect(service.updateProject).not.toHaveBeenCalled();
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('   ');
  });

  it('cancels editing and restores the original name', async () => {
    await renderProjectPage(givenProject(), OVERVIEW);

    fireEvent.click(renameButton());
    const input = screen.getByDisplayValue('Tese');
    fireEvent.change(input, { target: { value: 'Outro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(renameButton());

    expect(screen.getByDisplayValue('Tese')).toBeInTheDocument();
  });

  it('alerts when the rename fails and keeps editing', async () => {
    const service = givenProject();
    service.updateProject.mockRejectedValue(new Error('dup'));
    const dialogs = await renderProjectPage(service, OVERVIEW);

    fireEvent.click(renameButton());
    fireEvent.change(screen.getByDisplayValue('Tese'), { target: { value: 'X' } });
    fireEvent.click(saveNameButton());

    await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith('Erro ao atualizar nome do projeto'));
    expect(screen.getByDisplayValue('X')).toBeInTheDocument();
  });
});

describe('ProjectDetailsPage delete', () => {
  it('deletes after confirmation and returns to the project list', async () => {
    const service = givenProject();
    const dialogs = await renderProjectPage(service, OVERVIEW);

    fireEvent.click(deleteButton());

    expect(await screen.findByText('Lista de projetos')).toBeInTheDocument();
    expect(dialogs.confirmMessage.mock.calls[0][0]).toContain('excluir o projeto "Tese"');
    expect(service.deleteProject).toHaveBeenCalledWith(1);
  });

  it('keeps the project when the user declines', async () => {
    const service = givenProject();
    const dialogs = await renderProjectPage(service, OVERVIEW);
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
    const dialogs = await renderProjectPage(service, OVERVIEW);

    fireEvent.click(deleteButton());

    await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith('Erro ao excluir projeto'));
    expect(screen.queryByText('Lista de projetos')).not.toBeInTheDocument();
  });
});

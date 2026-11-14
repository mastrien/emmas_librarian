import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Layout } from '../common/Layout';
import { useRefreshProjectNav } from '../common/shell/projectNavRefresh';
import { ProjectNavPortal } from '../common/shell/projectNavSlot';
import { FakeDialogsProvider } from '../common/dialogs/__tests__/fakes/FakeDialogs';
import type { ProjectDocument } from '../../types';
import type { UpdateStatusResponse } from '../../types';

import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {},
}));

describe('Layout Component', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    localStorage.clear();
    fakeService.getAppVersion.mockResolvedValue('1.1.10');
  });

  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Layout>
          <div>Test Children</div>
        </Layout>
      </MemoryRouter>,
    );

  it('shows the module rail with the screen inside the frame', async () => {
    renderAt('/');

    await waitFor(() => expect(fakeService.getAppVersion).toHaveBeenCalled());

    const rail = screen.getByRole('navigation', { name: 'Módulos' });
    for (const name of ['Início', 'Perguntar aos projetos', 'Biblioteca de PDFs', 'Agenda', 'Configurações']) {
      expect(within(rail).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('Test Children')).toBeInTheDocument();
  });

  it('marks the module of the current route as the current page', async () => {
    renderAt('/agenda');

    await waitFor(() => expect(fakeService.getAppVersion).toHaveBeenCalled());

    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');
  });

  it('shows the project name in the title bar path on a project screen', async () => {
    fakeService.getProject.mockResolvedValue({ id: 3, name: 'Previsão de chuva', created_at: '' });

    renderAt('/projects/3/search');

    const path = screen.getByRole('navigation', { name: 'Caminho' });
    expect(await within(path).findByRole('link', { name: 'Previsão de chuva' })).toHaveAttribute('href', '/projects/3');
    expect(within(path).getByText('Nova busca')).toHaveAttribute('aria-current', 'page');
    expect(fakeService.getProject).toHaveBeenCalledWith(3);
  });

  describe('project sidebar', () => {
    beforeEach(() => {
      fakeService.getProject.mockResolvedValue({
        id: 3,
        name: 'Previsão de chuva',
        created_at: '2026-08-06T12:00:00Z',
      });
      fakeService.getProjectNavCounts.mockResolvedValue({
        articles: 96,
        categories: 4,
        searches: 2,
        investigations: 1,
      });
    });

    // Board 159: the investigation screen lists its investigations under its own sidebar item.
    it("puts a screen's sub-pages under its lit sidebar item, and nowhere on other screens", async () => {
      const renderWithSubPages = (path: string) =>
        render(
          <MemoryRouter initialEntries={[path]}>
            <Layout>
              <ProjectNavPortal>
                <a href="/x">#14 · sub</a>
              </ProjectNavPortal>
            </Layout>
          </MemoryRouter>,
        );

      const { unmount } = renderWithSubPages('/projects/3/investigation/14');
      const sidebar = screen.getByRole('complementary', { name: 'Projeto' });
      const sub = within(sidebar).getByRole('link', { name: '#14 · sub' });
      const item = within(sidebar).getByRole('link', { name: /Investigação com IA/ });
      expect(item.nextElementSibling).toContainElement(sub);
      unmount();

      renderWithSubPages('/projects/3/articles');
      expect(screen.queryByRole('link', { name: '#14 · sub' })).not.toBeInTheDocument();
      await screen.findByText('96 artigos · desde 06/08/2026');
    });

    it('lists the project sections with their counts and lights the current one', async () => {
      renderAt('/projects/3/articles');

      const sidebar = screen.getByRole('complementary', { name: 'Projeto' });
      expect(await within(sidebar).findByText('96 artigos · desde 06/08/2026')).toBeInTheDocument();
      expect(within(sidebar).getByRole('link', { name: 'Artigos 96' })).toHaveAttribute('aria-current', 'page');
      expect(within(sidebar).getByRole('link', { name: 'Histórico 2' })).toHaveAttribute('href', '/projects/3/history');
      expect(within(sidebar).getByRole('link', { name: 'Visão geral' })).not.toHaveAttribute('aria-current');
      // #49 and #73: search, review and investigation are screens of their own, reached from here.
      expect(within(sidebar).getByRole('link', { name: 'Nova busca' })).toHaveAttribute('href', '/projects/3/search');
      expect(within(sidebar).getByRole('link', { name: 'Revisão sistemática' })).toHaveAttribute(
        'href',
        '/projects/3/review',
      );
      expect(within(sidebar).getByRole('link', { name: 'Investigação com IA 1' })).toHaveAttribute(
        'href',
        '/projects/3/investigation',
      );
    });

    it('lights the systematic review on every review screen', async () => {
      renderAt('/projects/3/review/prisma');

      const sidebar = screen.getByRole('complementary', { name: 'Projeto' });
      await within(sidebar).findByText('Previsão de chuva');
      expect(within(sidebar).getByRole('link', { name: 'Revisão sistemática' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('is not shown outside a project', async () => {
      renderAt('/agenda');

      await waitFor(() => expect(fakeService.getAppVersion).toHaveBeenCalled());
      expect(screen.queryByRole('complementary', { name: 'Projeto' })).not.toBeInTheDocument();
      expect(fakeService.getProjectNavCounts).not.toHaveBeenCalled();
    });

    describe('quick access', () => {
      const link = (id: number, extra: Partial<ProjectDocument> = {}): ProjectDocument => ({
        id,
        project_id: 3,
        title: `Link ${id}`,
        url: `https://exemplo.org/${id}`,
        created_at: '2026-01-01',
        position: id,
        ...extra,
      });
      const initialHeight = window.innerHeight;
      afterEach(() => {
        window.innerHeight = initialHeight;
      });
      const quickAccess = () => screen.getByRole('region', { name: 'Acesso rápido' });
      const renderWithDialogs = () =>
        render(
          <MemoryRouter initialEntries={['/projects/3/articles']}>
            <FakeDialogsProvider>
              <Layout>
                <div>Tela</div>
              </Layout>
            </FakeDialogsProvider>
          </MemoryRouter>,
        );

      it('lists the most recently opened links first, as many as fit, with the way to all of them', async () => {
        window.innerHeight = 600; // 5 slots
        fakeService.getProjectDocuments.mockResolvedValue([
          ...[1, 2, 3, 4, 5, 6].map((id) => link(id)),
          link(7, { last_opened_at: '2026-11-09 10:00:00' }),
        ]);

        renderAt('/projects/3/articles');

        const titles = await within(quickAccess()).findAllByRole('button', { name: /^Link/ });
        expect(titles.map((b) => b.textContent)).toEqual(['Link 7', 'Link 1', 'Link 2', 'Link 3', 'Link 4']);
        expect(within(quickAccess()).getByRole('link', { name: 'Ver todos na Visão geral' })).toHaveAttribute(
          'href',
          '/projects/3/overview',
        );
      });

      it('records the visit when a link is opened and lists the links again', async () => {
        fakeService.getProjectDocuments.mockResolvedValue([link(1)]);
        renderAt('/projects/3/articles');

        fireEvent.click(await within(quickAccess()).findByRole('button', { name: 'Link 1' }));

        await waitFor(() => expect(fakeService.markProjectDocumentOpened).toHaveBeenCalledWith(1));
        expect(fakeService.openProjectDocumentExternal).toHaveBeenCalledWith('https://exemplo.org/1', undefined);
        await waitFor(() => expect(fakeService.getProjectDocuments).toHaveBeenCalledTimes(2));
      });

      it('opens the quick access editor from its pencil', async () => {
        fakeService.getProjectDocuments.mockResolvedValue([]);
        renderWithDialogs();

        expect(await within(quickAccess()).findByText('Nenhum link ainda.')).toBeInTheDocument();
        fireEvent.click(within(quickAccess()).getByRole('button', { name: 'Gerenciar acesso rápido' }));

        expect(await screen.findByRole('dialog', { name: 'Gerenciar Acesso Rápido' })).toBeInTheDocument();
      });
    });

    // An import on the project page changes the counts without a navigation; the page asks the shell to recount.
    it('counts again when a screen asks for it', async () => {
      const RecountButton = () => <button onClick={useRefreshProjectNav()}>Recontar</button>;
      render(
        <MemoryRouter initialEntries={['/projects/3/articles']}>
          <Layout>
            <RecountButton />
          </Layout>
        </MemoryRouter>,
      );
      const sidebar = screen.getByRole('complementary', { name: 'Projeto' });
      await within(sidebar).findByRole('link', { name: 'Artigos 96' });
      fakeService.getProjectNavCounts.mockResolvedValue({
        articles: 97,
        categories: 4,
        searches: 3,
        investigations: 1,
      });

      fireEvent.click(screen.getByRole('button', { name: 'Recontar' }));

      expect(await within(sidebar).findByRole('link', { name: 'Artigos 97' })).toBeInTheDocument();
    });
  });

  it('opens the command palette from the title bar and closes it with Esc', async () => {
    localStorage.setItem('last_seen_version', '1.1.10');
    renderAt('/agenda');
    await waitFor(() => expect(fakeService.getAppVersion).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Ir para, buscar artigo, executar (Ctrl+K)' }));
    const palette = await screen.findByRole('dialog', { name: 'Ir para' });
    await within(palette).findByRole('option', { name: 'Início' });
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ir para' })).not.toBeInTheDocument());
  });

  it('opens the release notes from the rail', async () => {
    localStorage.setItem('last_seen_version', '1.1.10');
    renderAt('/');
    await waitFor(() => expect(fakeService.getAppVersion).toHaveBeenCalled());
    expect(screen.queryByText('Novidades da Versão 1.1.10')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Novidades' }));

    expect(await screen.findByText('Novidades da Versão 1.1.10')).toBeInTheDocument();
  });

  it('opens the help of the current screen from the rail', async () => {
    localStorage.setItem('last_seen_version', '1.1.10');
    renderAt('/');
    await waitFor(() => expect(fakeService.getAppVersion).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Ajuda sobre esta página' }));

    expect(await screen.findByRole('dialog', { name: 'Guia do Dashboard' })).toBeInTheDocument();
  });

  it('renders reader layout without header when pathname is /articles/', async () => {
    render(
      <MemoryRouter initialEntries={['/articles/123']}>
        <Layout>
          <div>Reader Mode Children</div>
        </Layout>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fakeService.getAppVersion).toHaveBeenCalled();
    });

    // The reader gives the PDF the whole width: no module rail.
    expect(screen.queryByRole('navigation', { name: 'Módulos' })).toBeNull();
    expect(screen.getByText('Reader Mode Children')).toBeInTheDocument();
  });

  it('shows changelog modal if last_seen_version is not set or different', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Layout>
          <div>Content</div>
        </Layout>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Novidades da Versão 1.1.10')).toBeInTheDocument();
    });

    const closeBtn = screen.getByText('Entendido, vamos lá!');
    fireEvent.click(closeBtn);

    expect(localStorage.getItem('last_seen_version')).toBe('1.1.10');
    expect(screen.queryByText('Novidades da Versão 1.1.10')).toBeNull();
  });

  describe('update banner', () => {
    const renderLayout = () =>
      render(
        <MemoryRouter initialEntries={['/']}>
          <Layout>
            <div>Conteúdo</div>
          </Layout>
        </MemoryRouter>,
      );
    const status = (overrides: Partial<UpdateStatusResponse>): UpdateStatusResponse => ({
      status: 'idle',
      updateInfo: null,
      downloadProgress: null,
      error: null,
      state: null,
      ...overrides,
    });

    beforeEach(() => {
      sessionStorage.clear();
    });

    it('shows the banner when an update is already available on load', async () => {
      fakeService.getUpdateStatus.mockResolvedValue(status({ status: 'available', updateInfo: { version: '1.3.0' } }));

      renderLayout();

      expect(await screen.findByText('v1.3.0')).toBeInTheDocument();
    });

    it('follows status events: shows on available, hides once the download starts', async () => {
      let pushStatus: (next: UpdateStatusResponse) => void = () => undefined;
      fakeService.onUpdateStatusChange.mockImplementation((callback) => {
        pushStatus = callback;
        return () => undefined;
      });
      renderLayout();
      await waitFor(() => expect(fakeService.getUpdateStatus).toHaveBeenCalled());

      act(() => pushStatus(status({ status: 'available', updateInfo: { version: '1.4.0' } })));
      expect(await screen.findByText('v1.4.0')).toBeInTheDocument();

      act(() => pushStatus(status({ status: 'downloading' })));
      await waitFor(() => expect(screen.queryByText('v1.4.0')).toBeNull());
    });

    it('starts the download from the banner', async () => {
      fakeService.getUpdateStatus.mockResolvedValue(status({ status: 'available', updateInfo: { version: '1.3.0' } }));
      renderLayout();

      fireEvent.click(await screen.findByRole('button', { name: 'Atualizar' }));

      await waitFor(() => expect(fakeService.downloadUpdate).toHaveBeenCalledTimes(1));
    });

    it('shows the banner in the PDF reader layout too', async () => {
      fakeService.getUpdateStatus.mockResolvedValue(status({ status: 'available', updateInfo: { version: '1.3.0' } }));
      render(
        <MemoryRouter initialEntries={['/articles/7']}>
          <Layout>
            <div>Leitor</div>
          </Layout>
        </MemoryRouter>,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Atualizar' }));

      await waitFor(() => expect(fakeService.downloadUpdate).toHaveBeenCalledTimes(1));
    });
  });
});

import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Layout } from '../common/Layout';
import { useRefreshProjectNav } from '../common/shell/projectNavRefresh';
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

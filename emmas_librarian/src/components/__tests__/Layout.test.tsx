import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Layout } from '../common/Layout';
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

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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

  it('renders standard layout header, content, and sidebar buttons', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Layout>
          <div>Test Children</div>
        </Layout>
      </MemoryRouter>,
    );

    // Wait for version check
    await waitFor(() => {
      expect(fakeService.getAppVersion).toHaveBeenCalled();
    });

    expect(screen.getAllByText("Emma's Librarian")[0]).toBeInTheDocument();

    // Open 3-dots dropdown menu
    fireEvent.mouseEnter(screen.getByTitle('Mais opções'));

    expect(screen.getByText('Projetos')).toBeInTheDocument();
    expect(screen.getByText('Configurações')).toBeInTheDocument();
    expect(screen.getByText('Test Children')).toBeInTheDocument();
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

    // Reader layout shouldn't have header nav items like "Projetos"
    expect(screen.queryByText('Projetos')).toBeNull();
    expect(screen.queryByText('Configurações')).toBeNull();
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

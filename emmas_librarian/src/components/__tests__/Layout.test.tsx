import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Layout } from '../common/Layout';

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
});

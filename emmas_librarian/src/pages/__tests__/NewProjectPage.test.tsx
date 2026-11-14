import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NewProjectPage } from '../NewProjectPage';
import { BrowserRouter } from 'react-router-dom';

import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { FakeDialogs, FakeDialogsProvider } from '../../components/common/dialogs/__tests__/fakes/FakeDialogs';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {},
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

let dialogs = new FakeDialogs();

const renderPage = () =>
  render(
    <BrowserRouter>
      <FakeDialogsProvider dialogs={dialogs}>
        <NewProjectPage />
      </FakeDialogsProvider>
    </BrowserRouter>,
  );

const typeName = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText(/Ex: Sistemas de/i), { target: { value } });

describe('NewProjectPage', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    mockNavigate.mockClear();
    dialogs = new FakeDialogs();
  });

  it('shows the form and what usually comes after creating a project (board 152)', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Novo projeto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar projeto/i })).toBeDisabled();
    const after = screen.getByRole('complementary', { name: 'Depois de criar' });
    expect(after).toHaveTextContent('Buscar nas bases');
    expect(after).toHaveTextContent('Escrever os critérios');
  });

  it('creates the project and opens it', async () => {
    fakeService.createProject.mockResolvedValue({ id: 1, name: 'Test', created_at: '' });
    renderPage();

    typeName('Test Project');
    fireEvent.click(screen.getByRole('button', { name: /criar projeto/i }));

    await waitFor(() => {
      expect(fakeService.createProject).toHaveBeenCalledWith('Test Project');
      expect(mockNavigate).toHaveBeenCalledWith('/projects/1');
    });
  });

  it('shows why the creation failed', async () => {
    fakeService.createProject.mockRejectedValue(new Error('Failed to create'));
    renderPage();

    typeName('Test Project');
    fireEvent.click(screen.getByRole('button', { name: /criar projeto/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to create');
  });

  it('goes back to the home with Cancelar', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/');
  });

  it('imports a project from here and opens it', async () => {
    fakeService.importProject.mockResolvedValue(7);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Importar um projeto (.emmapcarc)' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/projects/7'));
  });

  it('stays here, telling why, when the import fails', async () => {
    fakeService.importProject.mockRejectedValue(new Error('arquivo corrompido'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Importar um projeto (.emmapcarc)' }));

    await waitFor(() => expect(dialogs.informed[0].message).toBe('Erro ao importar projeto: arquivo corrompido'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

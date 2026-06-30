import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NewProjectPage } from '../NewProjectPage';
import { BrowserRouter } from 'react-router-dom';

import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
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

describe('NewProjectPage', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    mockNavigate.mockClear();
  });

  it('renders correctly', () => {
    render(
      <BrowserRouter>
        <NewProjectPage />
      </BrowserRouter>,
    );
    expect(screen.getByText('Novo Projeto')).toBeInTheDOM();
    expect(screen.getByRole('button', { name: /criar projeto/i })).toBeInTheDOM();
  });

  it('handles project creation and redirects', async () => {
    fakeService.createProject.mockResolvedValue({ id: 1, name: 'Test', created_at: '' });

    render(
      <BrowserRouter>
        <NewProjectPage />
      </BrowserRouter>,
    );

    const input = screen.getByPlaceholderText(/Ex: Sistemas de/i);
    fireEvent.change(input, { target: { value: 'Test Project' } });

    const button = screen.getByRole('button', { name: /criar projeto/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(fakeService.createProject).toHaveBeenCalledWith('Test Project');
      expect(mockNavigate).toHaveBeenCalledWith('/projects/1');
    });
  });

  it('displays error message on failure', async () => {
    fakeService.createProject.mockRejectedValue(new Error('Failed to create'));

    render(
      <BrowserRouter>
        <NewProjectPage />
      </BrowserRouter>,
    );

    const input = screen.getByPlaceholderText(/Ex: Sistemas de/i);
    fireEvent.change(input, { target: { value: 'Test Project' } });

    const button = screen.getByRole('button', { name: /criar projeto/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Failed to create')).toBeInTheDOM();
    });
  });
});

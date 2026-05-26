import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NewProjectPage } from '../NewProjectPage';
import { projectService } from '../../services/api';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  projectService: {
    createProject: vi.fn(),
  }
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
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(
      <BrowserRouter>
        <NewProjectPage />
      </BrowserRouter>
    );
    expect(screen.getByText('Novo Projeto')).toBeInTheDOM();
    expect(screen.getByRole('button', { name: /criar projeto/i })).toBeInTheDOM();
  });

  it('handles project creation and redirects', async () => {
    (projectService.createProject as any).mockResolvedValue({ id: 1, name: 'Test' });
    
    render(
      <BrowserRouter>
        <NewProjectPage />
      </BrowserRouter>
    );

    const input = screen.getByPlaceholderText(/Ex: Sistemas de/i);
    fireEvent.change(input, { target: { value: 'Test Project' } });

    const button = screen.getByRole('button', { name: /criar projeto/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(projectService.createProject).toHaveBeenCalledWith('Test Project');
      expect(mockNavigate).toHaveBeenCalledWith('/projects/1');
    });
  });

  it('displays error message on failure', async () => {
    (projectService.createProject as any).mockRejectedValue(new Error('Failed to create'));
    
    render(
      <BrowserRouter>
        <NewProjectPage />
      </BrowserRouter>
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

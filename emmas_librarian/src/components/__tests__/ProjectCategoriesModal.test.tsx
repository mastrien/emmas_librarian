import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectCategoriesModal } from '../ProjectCategoriesModal';
import { projectService } from '../../services/api';

vi.mock('../../services/api', () => ({
  projectService: {
    getProjectCategories: vi.fn(),
    createProjectCategory: vi.fn(),
    deleteProjectCategory: vi.fn(),
  }
}));

describe('ProjectCategoriesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (projectService.getProjectCategories as any).mockResolvedValue([
      { id: 1, project_id: 1, name: 'Method', type: 'text' }
    ]);
  });

  it('renders categories and allows creating new ones', async () => {
    render(<ProjectCategoriesModal isOpen={true} projectId={1} onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText('Method')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Nome (ex: Metodologia)');
    fireEvent.change(input, { target: { value: 'New Category' } });
    
    // Button with Plus icon might not have text, we can find by type submit
    const buttons = screen.getAllByRole('button');
    const submitBtn = buttons.find(b => b.getAttribute('type') === 'submit');
    expect(submitBtn).toBeDefined();

    (projectService.createProjectCategory as any).mockResolvedValue(2);
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      expect(projectService.createProjectCategory).toHaveBeenCalledWith(1, 'New Category', 'text', '');
    });
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<ProjectCategoriesModal isOpen={false} projectId={1} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });
});

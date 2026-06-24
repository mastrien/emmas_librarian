import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectCategoriesModal } from '../modals/ProjectCategoriesModal';

import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {}
}));

describe('ProjectCategoriesModal', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    fakeService.getProjectCategories.mockResolvedValue([
      { id: 1, project_id: 1, name: 'Method', type: 'text' },
    ]);
  });

  it('renders categories and allows creating new ones', async () => {
    render(<ProjectCategoriesModal isOpen={true} projectId={1} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Method')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Nome (ex: Metodologia)');
    fireEvent.change(input, { target: { value: 'New Enum Category' } });

    // Change type to enum to show options input
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'enum' } });

    const optionsInput = screen.getByPlaceholderText('Opções separadas por vírgula (ex: Qualitativa, Quantitativa)');
    fireEvent.change(optionsInput, { target: { value: 'Opt1, Opt2' } });

    // Button with Plus icon might not have text, we can find by type submit
    const buttons = screen.getAllByRole('button');
    const submitBtn = buttons.find((b) => b.getAttribute('type') === 'submit');
    expect(submitBtn).toBeDefined();

    fakeService.createProjectCategory.mockResolvedValue(2);
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      // It should pass an array of objects
      expect(fakeService.createProjectCategory).toHaveBeenCalledWith(1, 'New Enum Category', 'enum', [
        { name: 'Opt1' },
        { name: 'Opt2' },
      ]);
    });
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<ProjectCategoriesModal isOpen={false} projectId={1} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });
});

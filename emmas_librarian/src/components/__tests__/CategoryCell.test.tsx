import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CategoryCell } from '../common/CategoryCell';
import { projectService } from '../../services/api';

vi.mock('../../services/api', () => ({
  projectService: {
    setArticleCategory: vi.fn(),
  }
}));

describe('CategoryCell', () => {
  it('renders text category and allows editing', async () => {
    render(<CategoryCell articleId={1} category={{ id: 10, project_id: 1, name: 'Method', type: 'text' }} initialValue="Qualitative" />);
    
    expect(screen.getByText('Qualitative')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Qualitative'));
    
    const input = screen.getByDisplayValue('Qualitative');
    fireEvent.change(input, { target: { value: 'Quantitative' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(projectService.setArticleCategory).toHaveBeenCalledWith(1, 10, 'Quantitative');
    });
    
    expect(screen.getByText('Quantitative')).toBeInTheDocument();
  });

  it('renders boolean category as select', async () => {
    render(<CategoryCell articleId={2} category={{ id: 11, project_id: 1, name: 'Reviewed', type: 'boolean' }} initialValue="true" />);
    
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('true');
    
    fireEvent.change(select, { target: { value: 'false' } });

    await waitFor(() => {
      expect(projectService.setArticleCategory).toHaveBeenCalledWith(2, 11, 'false');
    });
  });

  it('renders enum category with parsed options and allows adding a new option', async () => {
    projectService.updateProjectCategory = vi.fn().mockResolvedValue(undefined);

    const category = {
      id: 12,
      project_id: 1,
      name: 'Status',
      type: 'enum',
      parsedOptions: [{ id: 1, name: 'To Do' }, { id: 2, name: 'In Progress' }]
    };

    render(<CategoryCell articleId={3} category={category} initialValue="To Do" />);

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('To Do');

    // Select 'Add new option...'
    fireEvent.change(select, { target: { value: '__ADD_NEW__' } });
    
    // It should render an input for the new option
    const input = screen.getByPlaceholderText('Nova opção...');
    expect(input).toBeInTheDocument();

    // Type the new option and blur to save
    fireEvent.change(input, { target: { value: 'Done' } });
    fireEvent.blur(input);

    await waitFor(() => {
      // It should have called updateProjectCategory with the old parsedOptions AND the new one
      expect(projectService.updateProjectCategory).toHaveBeenCalledWith(12, 'Status', 'enum', [
        { id: 1, name: 'To Do' },
        { id: 2, name: 'In Progress' },
        { name: 'Done' }
      ]);
      // And then set the article category
      expect(projectService.setArticleCategory).toHaveBeenCalledWith(3, 12, 'Done');
    });
  });
});

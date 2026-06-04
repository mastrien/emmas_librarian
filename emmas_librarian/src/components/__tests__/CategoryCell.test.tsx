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
});

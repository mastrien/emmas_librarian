import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectCategoriesTab } from '../components/ProjectCategoriesTab';
import { projectService } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  projectService: {
    exportCsv: vi.fn(),
    exportXlsx: vi.fn()
  }
}));

// Mock CategoryCell to avoid dealing with its complex internals
vi.mock('../../../components/common/CategoryCell', () => ({
  CategoryCell: ({ initialValue }: any) => <div data-testid="category-cell">{initialValue}</div>
}));

describe('ProjectCategoriesTab', () => {
  const mockProject = {
    id: 1,
    name: 'Test Project',
    created_at: '2023-01-01T00:00:00.000Z',
    description: '',
    updated_at: '2023-01-01T00:00:00.000Z',
  };

  const mockProjectCategories = [
    { id: 1, name: 'Methodology' },
    { id: 2, name: 'Results' }
  ];

  const mockNonArchivedArticles: any[] = [
    { id: 101, title: 'Article 1' },
    { id: 102, title: 'Article 2' }
  ];

  const mockArticleCategories = [
    { article_id: 101, category_id: 1, value: 'Qualitative' },
    { article_id: 101, category_id: 2, value: 'Positive' }
  ];

  const defaultProps = {
    project: mockProject,
    projectCategories: mockProjectCategories,
    articleCategories: mockArticleCategories,
    nonArchivedArticles: mockNonArchivedArticles
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('renders categories and articles', () => {
    render(<ProjectCategoriesTab {...defaultProps} />);
    expect(screen.getByText('Categorias e Extrações')).toBeInTheDocument();
    
    // Headers
    expect(screen.getByText('ARTIGO')).toBeInTheDocument();
    expect(screen.getByText('Methodology')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();

    // Articles
    expect(screen.getByText('Article 1')).toBeInTheDocument();
    expect(screen.getByText('Article 2')).toBeInTheDocument();

    // Values
    expect(screen.getByText('Qualitative')).toBeInTheDocument();
    expect(screen.getByText('Positive')).toBeInTheDocument();
  });

  it('renders empty state when there are no articles', () => {
    render(<ProjectCategoriesTab {...defaultProps} nonArchivedArticles={[]} />);
    expect(screen.getByText('Nenhum artigo encontrado.')).toBeInTheDocument();
  });

  it('handles CSV export successfully', async () => {
    (projectService.exportCsv as any).mockResolvedValue('/path/to/file.csv');
    render(<ProjectCategoriesTab {...defaultProps} />);
    
    const exportCsvBtn = screen.getByText('Exportar CSV');
    await act(async () => {
      fireEvent.click(exportCsvBtn);
    });

    expect(projectService.exportCsv).toHaveBeenCalledWith(1);
    expect(window.alert).toHaveBeenCalledWith('CSV exportado com sucesso para: /path/to/file.csv');
  });

  it('handles CSV export error', async () => {
    (projectService.exportCsv as any).mockRejectedValue(new Error('Export failed'));
    render(<ProjectCategoriesTab {...defaultProps} />);
    
    const exportCsvBtn = screen.getByText('Exportar CSV');
    await act(async () => {
      fireEvent.click(exportCsvBtn);
    });

    expect(window.alert).toHaveBeenCalledWith('Erro ao exportar CSV: Export failed');
  });

  it('handles XLSX export successfully', async () => {
    (projectService.exportXlsx as any).mockResolvedValue('/path/to/file.xlsx');
    render(<ProjectCategoriesTab {...defaultProps} />);
    
    const exportXlsxBtn = screen.getByText('Exportar XLSX');
    await act(async () => {
      fireEvent.click(exportXlsxBtn);
    });

    expect(projectService.exportXlsx).toHaveBeenCalledWith(1);
    expect(window.alert).toHaveBeenCalledWith('XLSX exportado com sucesso para: /path/to/file.xlsx');
  });

  it('handles XLSX export error', async () => {
    (projectService.exportXlsx as any).mockRejectedValue(new Error('Export failed'));
    render(<ProjectCategoriesTab {...defaultProps} />);
    
    const exportXlsxBtn = screen.getByText('Exportar XLSX');
    await act(async () => {
      fireEvent.click(exportXlsxBtn);
    });

    expect(window.alert).toHaveBeenCalledWith('Erro ao exportar XLSX: Export failed');
  });

  it('changes background on mouse enter and leave', () => {
    render(<ProjectCategoriesTab {...defaultProps} />);
    const articleRow = screen.getByText('Article 1').closest('tr');
    
    if (articleRow) {
      fireEvent.mouseEnter(articleRow);
      expect(articleRow.style.background).toBe('var(--bg-main)');
      
      fireEvent.mouseLeave(articleRow);
      expect(articleRow.style.background).toBe('transparent');
    }
  });
});

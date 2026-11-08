import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectCategoriesTab } from '../components/ProjectCategoriesTab';
import { projectService } from '../../../services/api';
import { FakeDialogs, withFakeDialogs } from '../../../components/common/dialogs/__tests__/fakes/FakeDialogs';

let dialogs = new FakeDialogs();
beforeEach(() => {
  dialogs = new FakeDialogs();
});

vi.mock('../../../services/api', async () => {
  const { FakeProjectService } = await import('../../../services/__tests__/fakes/FakeProjectService');
  return { projectService: FakeProjectService.create() };
});

// Mock CategoryCell to avoid dealing with its complex internals
vi.mock('../../../components/common/CategoryCell', () => ({
  CategoryCell: ({ initialValue }: any) => <div data-testid="category-cell">{initialValue}</div>,
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
    { id: 1, project_id: 1, name: 'Methodology', type: 'text' },
    { id: 2, project_id: 1, name: 'Results', type: 'text' },
  ];

  const mockNonArchivedArticles: any[] = [
    { id: 101, title: 'Article 1' },
    { id: 102, title: 'Article 2' },
  ];

  const mockArticleCategories = [
    { article_id: 101, category_id: 1, name: 'Methodology', type: 'text', value: 'Qualitative' },
    { article_id: 101, category_id: 2, name: 'Results', type: 'text', value: 'Positive' },
  ];

  const defaultProps = {
    project: mockProject,
    projectCategories: mockProjectCategories,
    articleCategories: mockArticleCategories,
    nonArchivedArticles: mockNonArchivedArticles,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders categories and articles', () => {
    render(<ProjectCategoriesTab {...defaultProps} />, { wrapper: withFakeDialogs(dialogs) });
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
    render(<ProjectCategoriesTab {...defaultProps} nonArchivedArticles={[]} />, { wrapper: withFakeDialogs(dialogs) });
    expect(screen.getByText('Nenhum artigo encontrado.')).toBeInTheDocument();
  });

  it('handles CSV export successfully', async () => {
    (projectService.exportCsv as any).mockResolvedValue('/path/to/file.csv');
    render(<ProjectCategoriesTab {...defaultProps} />, { wrapper: withFakeDialogs(dialogs) });

    const exportCsvBtn = screen.getByText('Exportar CSV');
    await act(async () => {
      fireEvent.click(exportCsvBtn);
    });

    expect(projectService.exportCsv).toHaveBeenCalledWith(1);
    expect(dialogs.informMessage).toHaveBeenCalledWith('CSV exportado com sucesso para: /path/to/file.csv');
  });

  it('handles CSV export error', async () => {
    (projectService.exportCsv as any).mockRejectedValue(new Error('Export failed'));
    render(<ProjectCategoriesTab {...defaultProps} />, { wrapper: withFakeDialogs(dialogs) });

    const exportCsvBtn = screen.getByText('Exportar CSV');
    await act(async () => {
      fireEvent.click(exportCsvBtn);
    });

    expect(dialogs.informMessage).toHaveBeenCalledWith('Erro ao exportar CSV: Export failed');
  });

  it('handles XLSX export successfully', async () => {
    (projectService.exportXlsx as any).mockResolvedValue('/path/to/file.xlsx');
    render(<ProjectCategoriesTab {...defaultProps} />, { wrapper: withFakeDialogs(dialogs) });

    const exportXlsxBtn = screen.getByText('Exportar XLSX');
    await act(async () => {
      fireEvent.click(exportXlsxBtn);
    });

    expect(projectService.exportXlsx).toHaveBeenCalledWith(1);
    expect(dialogs.informMessage).toHaveBeenCalledWith('XLSX exportado com sucesso para: /path/to/file.xlsx');
  });

  it('handles XLSX export error', async () => {
    (projectService.exportXlsx as any).mockRejectedValue(new Error('Export failed'));
    render(<ProjectCategoriesTab {...defaultProps} />, { wrapper: withFakeDialogs(dialogs) });

    const exportXlsxBtn = screen.getByText('Exportar XLSX');
    await act(async () => {
      fireEvent.click(exportXlsxBtn);
    });

    expect(dialogs.informMessage).toHaveBeenCalledWith('Erro ao exportar XLSX: Export failed');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProjectDetailsPage } from '../ProjectDetailsPage';
import { projectService } from '../../services/api';

vi.mock('../../services/api', () => ({
  projectService: {
    getProject: vi.fn().mockResolvedValue({ id: 1, name: 'Project 1' }),
    getSearchHistory: vi.fn().mockResolvedValue([]),
    getDiaryEntries: vi.fn().mockResolvedValue([]),
    getProjectDocuments: vi.fn().mockResolvedValue([]),
    getMassiveInvestigations: vi.fn().mockResolvedValue([]),
    getArticles: vi.fn().mockResolvedValue([]),
    getSetting: vi.fn().mockResolvedValue(''),
    getProjectCategories: vi.fn().mockResolvedValue([]),
    getAllProjectArticleCategories: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('../../components/ArticleModal', () => ({
  ArticleModal: () => <div data-testid="article-modal" />
}));
vi.mock('../../components/SearchHistoryModal', () => ({
  SearchHistoryModal: () => <div data-testid="search-history-modal" />
}));

describe('ProjectDetailsPage', () => {
  it('renders correctly', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });

  it('renders Open Access badge and filters articles when Open Access filter is checked', async () => {
    const mockArticles = [
      {
        id: 1,
        project_id: 1,
        title: 'Open Access Article',
        authors: 'Author A',
        year: 2023,
        source_databases: '["OpenAlex"]',
        status: 'new',
        is_oa: 1,
      },
      {
        id: 2,
        project_id: 1,
        title: 'Paywalled Article',
        authors: 'Author B',
        year: 2022,
        source_databases: '["Scopus"]',
        status: 'new',
        is_oa: 0,
      }
    ];

    vi.mocked(projectService.getArticles).mockResolvedValueOnce(mockArticles as any);

    const { getByText, queryByText, getByLabelText, getByTestId } = render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the articles to load
    await vi.waitFor(() => {
      expect(getByText('Open Access Article')).toBeInTheDocument();
      expect(getByText('Paywalled Article')).toBeInTheDocument();
    });

    // Expect the badge 🔓 Acesso Aberto to be in the document
    expect(getByText('🔓 Acesso Aberto')).toBeInTheDocument();

    const checkbox = getByLabelText('Apenas Acesso Aberto');
    expect(checkbox).toBeInTheDocument();

    // Check Open Access only
    fireEvent.click(checkbox);

    await vi.waitFor(() => {
      const mainTable = getByTestId('main-articles-table');
      expect(within(mainTable).getByText('Open Access Article')).toBeInTheDocument();
      expect(within(mainTable).queryByText('Paywalled Article')).not.toBeInTheDocument();
    });
  });

  it('toggles lateral panel and applies filters (status, database, tag cloud)', async () => {
    const mockArticles = [
      {
        id: 1,
        project_id: 1,
        title: 'Article One',
        authors: 'Author A',
        year: 2023,
        source_databases: '["OpenAlex"]',
        status: 'new',
        document_type: 'journal-article',
        author_keywords: 'React; Testing',
      },
      {
        id: 2,
        project_id: 1,
        title: 'Article Two',
        authors: 'Author B',
        year: 2022,
        source_databases: '["Scopus"]',
        status: 'read',
        document_type: 'book',
        author_keywords: 'Database; SQL',
      }
    ];

    vi.mocked(projectService.getArticles).mockResolvedValueOnce(mockArticles as any);

    const { getByText, queryByText, getByLabelText, getByTestId, getByRole } = render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the articles to load (by default status 'new' is shown)
    await vi.waitFor(() => {
      const mainTable = getByTestId('main-articles-table');
      expect(within(mainTable).getByText('Article One')).toBeInTheDocument();
      expect(within(mainTable).queryByText('Article Two')).not.toBeInTheDocument();
    });

    // Check that toggle sidebar button is present
    const toggleBtn = getByRole('button', { name: /Filtros/ });
    expect(toggleBtn).toBeInTheDocument();

    // Select "Lidos" status filter
    const readRadio = getByLabelText('Lidos');
    fireEvent.click(readRadio);

    await vi.waitFor(() => {
      const mainTable = getByTestId('main-articles-table');
      expect(within(mainTable).queryByText('Article One')).not.toBeInTheDocument();
      expect(within(mainTable).getByText('Article Two')).toBeInTheDocument();
    });

    // Change status filter to "Todos" to show both articles
    const allRadio = getByLabelText('Todos');
    fireEvent.click(allRadio);

    await vi.waitFor(() => {
      const mainTable = getByTestId('main-articles-table');
      expect(within(mainTable).getByText('Article One')).toBeInTheDocument();
      expect(within(mainTable).getByText('Article Two')).toBeInTheDocument();
    });

    // Filter by database "OpenAlex"
    const openAlexCheckbox = getByLabelText(/OpenAlex/);
    fireEvent.click(openAlexCheckbox);

    await vi.waitFor(() => {
      const mainTable = getByTestId('main-articles-table');
      expect(within(mainTable).getByText('Article One')).toBeInTheDocument();
      expect(within(mainTable).queryByText('Article Two')).not.toBeInTheDocument();
    });

    // Uncheck database "OpenAlex" to show both again
    fireEvent.click(openAlexCheckbox);

    // Filter by tag cloud keyword "SQL"
    await vi.waitFor(() => {
      expect(getByText('SQL')).toBeInTheDocument();
    });
    const sqlTag = getByText('SQL');
    fireEvent.click(sqlTag);

    await vi.waitFor(() => {
      const mainTable = getByTestId('main-articles-table');
      expect(within(mainTable).queryByText('Article One')).not.toBeInTheDocument();
      expect(within(mainTable).getByText('Article Two')).toBeInTheDocument();
    });
  });
});

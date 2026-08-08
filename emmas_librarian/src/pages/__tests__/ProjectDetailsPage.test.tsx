import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, createEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProjectDetailsPage } from '../ProjectDetailsPage';
import { GlobalErrorProvider } from '../../contexts/GlobalErrorContext';

import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {},
}));

vi.mock('../../components/ArticleModal', () => ({
  ArticleModal: () => <div data-testid="article-modal" />,
}));
vi.mock('../../components/modals/SearchHistoryModal', () => ({
  SearchHistoryModal: () => <div data-testid="search-history-modal" />,
}));

describe('ProjectDetailsPage', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    // Re-apply defaults that the component needs on every render
    fakeService.getProject.mockResolvedValue({ id: 1, name: 'Project 1', created_at: '' });
  });

  it('renders correctly', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <GlobalErrorProvider>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailsPage />} />
          </Routes>
        </GlobalErrorProvider>
      </MemoryRouter>,
    );
    expect(container).toBeInTheDocument();
  });

  it.skip('renders Open Access badge and filters articles when Open Access filter is checked', async () => {
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
      },
    ];

    fakeService.getArticles.mockResolvedValueOnce(mockArticles as unknown as import('../../types').Article[]);

    const { getByText, queryByText, getByLabelText, getByTestId } = render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <GlobalErrorProvider>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailsPage />} />
          </Routes>
        </GlobalErrorProvider>
      </MemoryRouter>,
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
      const mainTable = screen.getAllByTestId('main-articles-table')[0];
      expect(within(mainTable).getByText('Open Access Article')).toBeInTheDocument();
      expect(within(mainTable).queryByText('Paywalled Article')).not.toBeInTheDocument();
    });
  });

  it.skip('toggles lateral panel and applies filters (status, database, tag cloud)', async () => {
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
      },
    ];

    fakeService.getArticles.mockResolvedValueOnce(mockArticles as unknown as import('../../types').Article[]);

    const { getByText, queryByText, getByLabelText, getByTestId, getByRole } = render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <GlobalErrorProvider>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailsPage />} />
          </Routes>
        </GlobalErrorProvider>
      </MemoryRouter>,
    );

    // Wait for the articles to load (by default status 'new' is shown)
    await vi.waitFor(() => {
      const mainTable = screen.getAllByTestId('main-articles-table')[0];
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
      const mainTable = screen.getAllByTestId('main-articles-table')[0];
      expect(within(mainTable).queryByText('Article One')).not.toBeInTheDocument();
      expect(within(mainTable).getByText('Article Two')).toBeInTheDocument();
    });

    // Change status filter to "Todos" to show both articles
    const allRadio = getByLabelText('Todos');
    fireEvent.click(allRadio);

    await vi.waitFor(() => {
      const mainTable = screen.getAllByTestId('main-articles-table')[0];
      expect(within(mainTable).getByText('Article One')).toBeInTheDocument();
      expect(within(mainTable).getByText('Article Two')).toBeInTheDocument();
    });

    // Filter by database "OpenAlex"
    const openAlexCheckbox = getByLabelText(/OpenAlex/);
    fireEvent.click(openAlexCheckbox);

    await vi.waitFor(() => {
      const mainTable = screen.getAllByTestId('main-articles-table')[0];
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
      const mainTable = screen.getAllByTestId('main-articles-table')[0];
      expect(within(mainTable).queryByText('Article One')).not.toBeInTheDocument();
      expect(within(mainTable).getByText('Article Two')).toBeInTheDocument();
    });
  });

  it('manages drag and drop state without triggering leave on child element enter', async () => {
    const { getByTestId, queryByText } = render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <GlobalErrorProvider>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailsPage />} />
          </Routes>
        </GlobalErrorProvider>
      </MemoryRouter>,
    );

    await vi.waitFor(() => {
      expect(getByTestId('project-details-container')).toBeInTheDocument();
    });

    const container = getByTestId('project-details-container');

    expect(queryByText('Solte seus PDFs aqui para importar')).not.toBeInTheDocument();

    fireEvent.dragOver(container);
    expect(screen.getByText('Solte seus PDFs aqui para importar')).toBeInTheDocument();

    const childElement = document.createElement('div');
    container.appendChild(childElement);

    const leaveEvent = createEvent.dragLeave(container);
    Object.defineProperty(leaveEvent, 'relatedTarget', {
      value: childElement,
      writable: false,
    });
    fireEvent(container, leaveEvent);

    expect(screen.getByText('Solte seus PDFs aqui para importar')).toBeInTheDocument();

    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);

    const leaveOutsideEvent = createEvent.dragLeave(container);
    Object.defineProperty(leaveOutsideEvent, 'relatedTarget', {
      value: outsideElement,
      writable: false,
    });
    fireEvent(container, leaveOutsideEvent);

    expect(queryByText('Solte seus PDFs aqui para importar')).not.toBeInTheDocument();

    container.removeChild(childElement);
    document.body.removeChild(outsideElement);
  });

  it('saves massive investigation metadata and results (including skipped articles) correctly', async () => {
    const mockArticles = [
      { id: 1, title: 'Article One', local_file_path: 'path1.pdf' },
      { id: 2, title: 'Article Two', local_file_path: 'path2.pdf' },
    ];
    fakeService.getArticles.mockResolvedValue(mockArticles as any);
    fakeService.getAiModelConfigs.mockResolvedValue([
      { skill: 'extraction', provider: 'gemini', model_name: 'gemini-1.5-pro' },
    ] as any);

    fakeService.massiveExtraction
      .mockResolvedValueOnce([{ question: 'Q1?', answer: '{"synthesizedAnswer":"Ans1"}', quote: null }])
      .mockImplementationOnce(async () => {
        throw new Error('QUOTA_EXCEEDED');
      });

    const { getByTestId, getByText } = render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <GlobalErrorProvider>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailsPage />} />
          </Routes>
        </GlobalErrorProvider>
      </MemoryRouter>,
    );

    await vi.waitFor(() => {
      expect(getByTestId('project-details-container')).toBeInTheDocument();
    });

    const aiButton = screen.getByTitle('Extração Inteligente IA');
    fireEvent.click(aiButton);

    await vi.waitFor(() => {
      expect(screen.getByText('Investigação Massiva com IA')).toBeInTheDocument();
    });

    const questionInput = screen.getByPlaceholderText('Pergunta 1');
    fireEvent.change(questionInput, { target: { value: 'Q1?' } });

    const extractBtn = screen.getByText('Iniciar Investigação');
    fireEvent.click(extractBtn);

    await vi.waitFor(() => {
      expect(fakeService.saveMassiveInvestigation).toHaveBeenCalled();
    });

    expect(fakeService.saveMassiveInvestigation).toHaveBeenCalledWith(
      1,
      ['Q1?'],
      [1, 2],
      'Gemini (gemini-1.5-pro)',
      'Erro: Quota Excedida',
    );

    expect(fakeService.saveInvestigationResults).toHaveBeenCalledWith(
      0,
      1,
      expect.arrayContaining([
        expect.objectContaining({
          question: 'Q1?',
          status: 'success',
        }),
      ]),
    );

    expect(fakeService.saveInvestigationResults).toHaveBeenCalledWith(
      0,
      2,
      expect.arrayContaining([
        expect.objectContaining({
          question: 'Q1?',
          status: 'error',
          error_message: 'QUOTA_EXCEEDED',
        }),
      ]),
    );
  });

  it('renders history tab correctly when clicked', async () => {
    fakeService.getSearchHistory.mockResolvedValue([
      { id: 1, unified_query: 'test query', translated_queries: '{}', results_breakdown: '{}', total_results: 10, created_at: new Date().toISOString() }
    ]);
    const { getByTestId, queryByTestId, getByText } = render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <GlobalErrorProvider>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailsPage />} />
          </Routes>
        </GlobalErrorProvider>
      </MemoryRouter>,
    );

    await vi.waitFor(() => {
      expect(getByTestId('project-details-container')).toBeInTheDocument();
    });

    const historyTab = getByTestId('tab-history');
    fireEvent.click(historyTab);

    await vi.waitFor(() => {
      expect(getByTestId('search-history-modal')).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { DashboardPage } from '../DashboardPage';
import { NewProjectPage } from '../NewProjectPage';
import { ProjectDetailsPage } from '../ProjectDetailsPage';
import { SearchPage } from '../SearchPage';
import { SettingsPage } from '../SettingsPage';
import { TermsOfUsePage } from '../TermsOfUsePage';
import { ArticleReaderPage } from '../ArticleReaderPage';
import { GlobalErrorProvider } from '../../contexts/GlobalErrorContext';

import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {},
}));

vi.mock('react-pdf-highlighter', () => ({
  PdfHighlighter: () => <div data-testid="pdf-highlighter-mock" />,
  Tip: () => <div />,
  Highlight: () => <div />,
  Popup: () => <div />,
  AreaHighlight: () => <div />,
}));

// Mock window.matchMedia for some components that might need it
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('Page Rendering Coverage', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();

    // Default mocks to prevent infinite loading
    fakeService.getProject.mockResolvedValue({ id: 1, name: 'Test Project', created_at: '' });
    fakeService.getProjects.mockResolvedValue([]);
    fakeService.getArticles.mockResolvedValue([]);
    fakeService.getArticle.mockResolvedValue({
      id: 1,
      project_id: 1,
      title: 'Test',
      authors: '',
      year: 2024,
      source_databases: '[]',
      status: 'new',
    });
    fakeService.getSearchHistory.mockResolvedValue([]);
    fakeService.getSetting.mockResolvedValue('');
    fakeService.getProjectCategories.mockResolvedValue([]);
    fakeService.getAllProjectArticleCategories.mockResolvedValue([]);
    fakeService.getArticleCategories.mockResolvedValue([]);
  });

  const renderAndWait = async (element: React.ReactElement, initialEntry: string, routePath: string) => {
    const { container } = render(
      <GlobalErrorProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path={routePath} element={element} />
          </Routes>
        </MemoryRouter>
      </GlobalErrorProvider>,
    );

    // Wait for any "Carregando" text to disappear if it exists
    await waitFor(
      () => {
        const loadingElements = screen.queryAllByText(/Carregando/i);
        expect(loadingElements.length).toBe(0);
      },
      { timeout: 3000 },
    );

    return container;
  };

  it('renders DashboardPage without crashing', async () => {
    const container = await renderAndWait(<DashboardPage />, '/', '/');
    expect(container).toBeInTheDocument();
  });

  it('renders NewProjectPage without crashing', async () => {
    const container = await renderAndWait(<NewProjectPage />, '/new', '/new');
    expect(container).toBeInTheDocument();
  });

  it('renders ProjectDetailsPage without crashing', async () => {
    const container = await renderAndWait(<ProjectDetailsPage />, '/projects/1', '/projects/:id');
    expect(container).toBeInTheDocument();

    // Explicitly check that we're past the loading state
    expect(screen.queryByText(/Projeto não encontrado/i)).not.toBeInTheDocument();
  });

  it('renders SearchPage without crashing', async () => {
    const container = await renderAndWait(<SearchPage />, '/projects/1/search', '/projects/:id/search');
    expect(container).toBeInTheDocument();
  });

  it('renders SettingsPage without crashing', async () => {
    const container = await renderAndWait(<SettingsPage />, '/settings', '/settings');
    expect(container).toBeInTheDocument();
  });

  it('renders TermsOfUsePage without crashing', async () => {
    const container = await renderAndWait(<TermsOfUsePage />, '/terms', '/terms');
    expect(container).toBeInTheDocument();
  });

  it('renders ArticleReaderPage without crashing', async () => {
    const container = await renderAndWait(
      <ArticleReaderPage />,
      '/projects/1/article/1',
      '/projects/:id/article/:articleId',
    );
    expect(container).toBeInTheDocument();
  });
});

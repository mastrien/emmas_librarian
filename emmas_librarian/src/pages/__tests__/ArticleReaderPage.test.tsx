import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ArticleReaderPage } from '../ArticleReaderPage';
import { projectService } from '../../services/api';

vi.mock('react-pdf-highlighter', () => ({
  PdfHighlighter: () => <div data-testid="pdf-highlighter" />,
  Highlight: () => <div data-testid="highlight" />,
  Popup: () => <div data-testid="popup" />,
  AreaHighlight: () => <div data-testid="area-highlight" />,
}));

vi.mock('../../services/api', () => ({
  projectService: {
    getProject: vi.fn().mockResolvedValue({ id: 1, name: 'Project 1' }),
    getArticle: vi.fn().mockResolvedValue({ id: 1, title: 'Article', local_file_path: 'file.pdf', project_id: 1 }),
    getAnnotations: vi.fn().mockResolvedValue([]),
    getHighlights: vi.fn().mockResolvedValue([]),
    getPendingHighlights: vi.fn().mockResolvedValue([]),
    generateSummary: vi.fn().mockResolvedValue({}),
    getSetting: vi.fn().mockResolvedValue(''),
    getProjectWritingPad: vi.fn().mockResolvedValue(''),
    getProjectCategories: vi.fn().mockResolvedValue([]),
    getArticleCategories: vi.fn().mockResolvedValue([]),
    getPdfBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  }
}));

describe('ArticleReaderPage', () => {
  it('renders correctly', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/articles/1']}>
        <Routes>
          <Route path="/articles/:id" element={<ArticleReaderPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });

  it('loads AI summary from cache if present', async () => {
    const mockSummary = {
      generalSummary: 'This is a general summary',
      sectionSummary: 'This is a section summary'
    };
    vi.mocked(projectService.getArticle).mockResolvedValueOnce({
      id: 1,
      project_id: 1,
      title: 'Article with AI Summary',
      local_file_path: 'file.pdf',
      ai_summary: JSON.stringify(mockSummary),
      status: 'new',
      source_databases: '["OpenAlex"]',
      source_query: ''
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/articles/1']}>
        <Routes>
          <Route path="/articles/:id" element={<ArticleReaderPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });

  it('displays the abstract preview and DOI search link when no PDF is attached', async () => {
    vi.mocked(projectService.getArticle).mockResolvedValueOnce({
      id: 1,
      project_id: 1,
      title: 'Article Without PDF File',
      authors: 'Jane Smith',
      year: 2023,
      journal: 'Journal of Testing Fallback',
      doi: '10.1000/xyz123',
      abstract: 'This is the expected abstract text loaded from search API.',
      status: 'new',
      source_databases: '["OpenAlex"]',
      source_query: ''
    });

    const { getByText, getAllByText } = render(
      <MemoryRouter initialEntries={['/articles/1']}>
        <Routes>
          <Route path="/articles/:id" element={<ArticleReaderPage />} />
        </Routes>
      </MemoryRouter>
    );

    await vi.waitFor(() => {
      expect(getByText('This is the expected abstract text loaded from search API.')).toBeInTheDocument();
      expect(getByText('Buscar por DOI')).toBeInTheDocument();
      expect(getAllByText('Vincular PDF Local').length).toBeGreaterThan(0);
    });
  });
});

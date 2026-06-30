global.URL.createObjectURL = vi.fn(() => 'blob:mock');
global.URL.revokeObjectURL = vi.fn();
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ArticleReaderPage } from '../ArticleReaderPage';
import { GlobalErrorProvider } from '../../contexts/GlobalErrorContext';

vi.mock('react-pdf-highlighter', () => ({
  PdfLoader: ({ children }: { children: (pdf: unknown) => React.ReactNode }) => (
    <div data-testid="pdf-loader">{children({ numPages: 10, getPage: vi.fn() })}</div>
  ),
  PdfHighlighter: (props: any) => {
    // @ts-ignore
    global.mockPdfHighlighterProps = props;
    return <div data-testid="pdf-highlighter" className="pdfViewer" />;
  },
  Highlight: () => <div data-testid="highlight" />,
  Popup: () => <div data-testid="popup" />,
  AreaHighlight: () => <div data-testid="area-highlight" />,
}));

import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {},
}));

describe('ArticleReaderPage', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    // Re-apply defaults that the component needs on every render
    fakeService.getProject.mockResolvedValue({ id: 1, name: 'Project 1', created_at: '' });
    fakeService.getArticle.mockResolvedValue({
      id: 1,
      title: 'Article',
      local_file_path: 'file.pdf',
      project_id: 1,
      status: 'new',
    });
    fakeService.getPdfBuffer.mockResolvedValue(new ArrayBuffer(8));
  });

  it('renders correctly', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/articles/1']}>
        <GlobalErrorProvider>
          <Routes>
            <Route path="/articles/:id" element={<ArticleReaderPage />} />
          </Routes>
        </GlobalErrorProvider>
      </MemoryRouter>,
    );
    expect(container).toBeInTheDocument();
  });

  it('loads AI summary from cache if present', async () => {
    const mockSummary = {
      generalSummary: 'This is a general summary',
      sectionSummary: 'This is a section summary',
    };
    fakeService.getArticle.mockResolvedValueOnce({
      id: 1,
      project_id: 1,
      title: 'Article with AI Summary',
      local_file_path: 'file.pdf',
      ai_summary: JSON.stringify(mockSummary),
      status: 'new',
      source_databases: '["OpenAlex"]',
      source_query: '',
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/articles/1']}>
        <GlobalErrorProvider>
          <Routes>
            <Route path="/articles/:id" element={<ArticleReaderPage />} />
          </Routes>
        </GlobalErrorProvider>
      </MemoryRouter>,
    );
    expect(container).toBeInTheDocument();
  });

  it('displays the abstract preview and DOI search link when no PDF is attached', async () => {
    fakeService.getArticle.mockResolvedValueOnce({
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
      source_query: '',
    });

    const { getByText, getAllByText } = render(
      <MemoryRouter initialEntries={['/articles/1']}>
        <GlobalErrorProvider>
          <Routes>
            <Route path="/articles/:id" element={<ArticleReaderPage />} />
          </Routes>
        </GlobalErrorProvider>
      </MemoryRouter>,
    );

    await vi.waitFor(() => {
      expect(getByText('This is the expected abstract text loaded from search API.')).toBeInTheDocument();
      expect(getByText('Buscar por DOI')).toBeInTheDocument();
      expect(getAllByText('Vincular PDF Local').length).toBeGreaterThan(0);
    });
  });
  it('maps highlight data structure correctly for react-pdf-highlighter to prevent crash', async () => {
    const mockHighlights = [
      {
        id: '101',
        article_id: 1,
        position_data: {
          boundingRect: { x1: 0, y1: 0, x2: 10, y2: 10, width: 10, height: 10, pageNumber: 1 },
          rects: [],
          pageNumber: 1,
        },
        content_text: 'Highlight text',
        comment: 'A note',
        color: 'yellow',
        annotation_id: 201,
      },
    ];
    fakeService.getHighlights.mockResolvedValueOnce(mockHighlights);

    render(
      <MemoryRouter initialEntries={['/articles/1']}>
        <GlobalErrorProvider>
          <Routes>
            <Route path="/articles/:id" element={<ArticleReaderPage />} />
          </Routes>
        </GlobalErrorProvider>
      </MemoryRouter>,
    );

    await vi.waitFor(() => {
      // @ts-ignore
      expect(global.mockPdfHighlighterProps).toBeDefined();
    });

    // @ts-ignore
    const passedHighlights = global.mockPdfHighlighterProps.highlights;
    expect(passedHighlights).toHaveLength(1);

    // Check if it mapped to the react-pdf-highlighter structure
    const hl = passedHighlights[0];
    expect(hl.position).toBeDefined(); // Used to be undefined when reading position_data directly
    expect(hl.position.pageNumber).toBe(1);
    expect(hl.content).toBeDefined();
    expect(hl.content.text).toBe('Highlight text');
    expect(hl.comment).toBeDefined();
    expect(hl.comment.text).toBe('A note');

    // Clean up
    // @ts-ignore
    delete global.mockPdfHighlighterProps;
  });
});

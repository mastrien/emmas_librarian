global.URL.createObjectURL = vi.fn(() => 'blob:mock');
global.URL.revokeObjectURL = vi.fn();
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ArticleReaderPage } from '../ArticleReaderPage';
import { GlobalErrorProvider } from '../../contexts/GlobalErrorContext';
import type { Article } from '../../types';

/** Props the mocked PdfHighlighter last received, so tests can inspect the mapped highlights. */
const highlighter = vi.hoisted(() => ({ props: null as null | { highlights: HighlighterHighlight[] } }));

interface HighlighterHighlight {
  position: { pageNumber: number };
  content: { text: string };
  comment: { text: string };
}

vi.mock('react-pdf-highlighter', () => ({
  PdfLoader: ({ children }: { children: (pdf: unknown) => React.ReactNode }) => (
    <div data-testid="pdf-loader">{children({ numPages: 10, getPage: vi.fn() })}</div>
  ),
  PdfHighlighter: (props: { highlights: HighlighterHighlight[] }) => {
    highlighter.props = props;
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

const renderReader = () =>
  render(
    <MemoryRouter initialEntries={['/articles/1']}>
      <GlobalErrorProvider>
        <Routes>
          <Route path="/articles/:id" element={<ArticleReaderPage />} />
        </Routes>
      </GlobalErrorProvider>
    </MemoryRouter>,
  );

const article = (overrides: Partial<Article> = {}) =>
  ({ id: 1, project_id: 1, title: 'Article', local_file_path: 'file.pdf', status: 'new', ...overrides }) as Article;

describe('ArticleReaderPage', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    highlighter.props = null;
    // Re-apply defaults that the component needs on every render
    fakeService.getProject.mockResolvedValue({ id: 1, name: 'Project 1', created_at: '' });
    fakeService.getArticle.mockResolvedValue(article());
    fakeService.getPdfBuffer.mockResolvedValue(new ArrayBuffer(8));
  });

  it('shows the article title and the PDF viewer once loaded', async () => {
    renderReader();

    expect(await screen.findByText('Article')).toBeInTheDocument();
    expect(await screen.findByTestId('pdf-highlighter')).toBeInTheDocument();
  });

  it('shows the cached AI summary in the "Insights IA" tab without generating a new one', async () => {
    fakeService.getArticle.mockResolvedValue(
      article({
        title: 'Article with AI Summary',
        ai_summary: JSON.stringify({
          generalSummary: 'This is a general summary',
          sectionSummary: 'This is a section summary',
        }),
      }),
    );
    renderReader();
    await screen.findByText('Article with AI Summary');

    fireEvent.click(screen.getByText('Insights IA'));

    expect(await screen.findByText('This is a general summary')).toBeInTheDocument();
    expect(screen.getByText('This is a section summary')).toBeInTheDocument();
    expect(fakeService.generateSummary).not.toHaveBeenCalled();
  });

  it('displays the abstract preview and DOI search link when no PDF is attached', async () => {
    fakeService.getArticle.mockResolvedValue(
      article({
        title: 'Article Without PDF File',
        local_file_path: undefined,
        authors: 'Jane Smith',
        year: 2023,
        journal: 'Journal of Testing Fallback',
        doi: '10.1000/xyz123',
        abstract: 'This is the expected abstract text loaded from search API.',
      }),
    );

    renderReader();

    expect(await screen.findByText('This is the expected abstract text loaded from search API.')).toBeInTheDocument();
    expect(screen.getByText('Buscar por DOI')).toBeInTheDocument();
    expect(screen.getAllByText('Vincular PDF Local').length).toBeGreaterThan(0);
  });

  it('maps highlight data structure correctly for react-pdf-highlighter to prevent crash', async () => {
    fakeService.getHighlights.mockResolvedValue([
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
    ]);

    renderReader();

    await waitFor(() => expect(highlighter.props?.highlights).toHaveLength(1));
    const [hl] = highlighter.props!.highlights;
    // position used to be undefined when position_data was passed through unmapped
    expect(hl.position.pageNumber).toBe(1);
    expect(hl.content.text).toBe('Highlight text');
    expect(hl.comment.text).toBe('A note');
  });
});

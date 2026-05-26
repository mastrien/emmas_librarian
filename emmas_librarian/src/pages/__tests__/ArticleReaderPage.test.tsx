import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ArticleReaderPage } from '../ArticleReaderPage';

vi.mock('react-pdf-highlighter', () => ({
  PdfHighlighter: () => <div data-testid="pdf-highlighter" />,
  Highlight: () => <div data-testid="highlight" />,
  Popup: () => <div data-testid="popup" />,
  AreaHighlight: () => <div data-testid="area-highlight" />,
}));

vi.mock('../../services/api', () => ({
  projectService: {
    getProject: vi.fn().mockResolvedValue({ id: 1, name: 'Project 1' }),
    getArticle: vi.fn().mockResolvedValue({ id: 1, title: 'Article', local_file_path: 'file.pdf' }),
    getAnnotations: vi.fn().mockResolvedValue([]),
    getHighlights: vi.fn().mockResolvedValue([]),
    getPendingHighlights: vi.fn().mockResolvedValue([]),
    generateSummary: vi.fn().mockResolvedValue({}),
  }
}));

describe('ArticleReaderPage', () => {
  it('renders correctly', async () => {
    const { container } = render(
      <BrowserRouter>
        <ArticleReaderPage />
      </BrowserRouter>
    );
    expect(container).toBeInTheDocument();
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ArticleTable } from '../common/ArticleTable';
import { Article } from '../../types';

// Mock react-virtuoso so we don't have to deal with ResizeObservers and height constraints in jsdom
vi.mock('react-virtuoso', () => ({
  TableVirtuoso: ({ data, itemContent, fixedHeaderContent }: any) => {
    return (
      <div data-testid="mock-virtuoso">
        <table>
          <thead>{fixedHeaderContent && fixedHeaderContent()}</thead>
          <tbody>
            {data.map((item: any, index: number) => (
              <tr key={item.id || index} data-testid={`row-${item.id}`}>
                {itemContent(index, item)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
}));

const mockArticles: Article[] = [
  {
    id: 1,
    project_id: 1,
    title: 'Test Article 1',
    authors: 'John Doe',
    year: 2023,
    source_query: 'test',
    source_databases: '["OpenAlex"]',
    csl_json: '{}',
    local_file_path: undefined,
    status: 'new',
    doi: '10.1000/123',
  },
  {
    id: 2,
    project_id: 1,
    title: 'Test Article 2',
    authors: 'Jane Doe',
    year: 2024,
    source_query: 'test',
    source_databases: '["Manual"]',
    csl_json: '{}',
    local_file_path: '/path/to/pdf',
    status: 'new',
    doi: undefined,
  },
];

describe('ArticleTable', () => {
  const defaultProps = {
    paginatedArticles: mockArticles,
    activeArticlesLength: mockArticles.length,
    uploadingId: null,
    onUnlinkClick: vi.fn(),
    onUploadClick: vi.fn(),
    onStatusChange: vi.fn(),
    onEditClick: vi.fn(),
    onArchiveClick: vi.fn(),
    isArticleManual: (article: Article) => (article.source_databases || '').includes('Manual'),
  };

  const renderComponent = (props = {}) => {
    return render(
      <BrowserRouter>
        {/* @ts-ignore */}
        <ArticleTable {...defaultProps} {...props} />
      </BrowserRouter>,
    );
  };

  it('renders correctly with articles', () => {
    renderComponent();
    expect(screen.getByText('Test Article 1')).toBeDefined();
    expect(screen.getByText('Test Article 2')).toBeDefined();
    expect(screen.getByText('John Doe')).toBeDefined();
  });

  it('renders empty state when no active articles', () => {
    renderComponent({ paginatedArticles: [], activeArticlesLength: 0 });
    expect(screen.getByText('Nenhum artigo ativo na biblioteca.')).toBeDefined();
    expect(screen.queryByTestId('mock-virtuoso')).toBeNull();
  });

  it('calls onUploadClick when Vincular PDF is clicked', () => {
    renderComponent();
    // Article 1 has no pdf, so it should have a link button
    const uploadBtn = screen.getAllByRole('button').find((b) => b.title === 'Vincular PDF Local');
    expect(uploadBtn).toBeDefined();
    fireEvent.click(uploadBtn!);
    expect(defaultProps.onUploadClick).toHaveBeenCalledWith(1);
  });

  it('calls onUnlinkClick when Desvincular PDF is clicked', () => {
    renderComponent();
    // Article 2 has a pdf, so it should have an unlink button
    const unlinkBtn = screen.getAllByRole('button').find((b) => b.title === 'Desvincular PDF');
    expect(unlinkBtn).toBeDefined();
    fireEvent.click(unlinkBtn!);
    expect(defaultProps.onUnlinkClick).toHaveBeenCalledWith(2);
  });

  it('calls onStatusChange when Marcar como Lido is clicked', () => {
    renderComponent();
    const readBtns = screen.getAllByRole('button').filter((b) => b.title === 'Marcar como Lido');
    fireEvent.click(readBtns[0]);
    expect(defaultProps.onStatusChange).toHaveBeenCalledWith(1, 'read');
  });

  it('shows Editar button only for manual articles and calls onEditClick', () => {
    renderComponent();
    const editBtns = screen.getAllByRole('button').filter((b) => b.title === 'Editar Metadados');
    // Only Article 2 is manual
    expect(editBtns).toHaveLength(1);
    fireEvent.click(editBtns[0]);
    expect(defaultProps.onEditClick).toHaveBeenCalledWith(mockArticles[1]);
  });

  it('calls onArchiveClick when Arquivar is clicked', () => {
    renderComponent();
    const archiveBtns = screen.getAllByRole('button').filter((b) => b.title === 'Arquivar');
    fireEvent.click(archiveBtns[0]);
    expect(defaultProps.onArchiveClick).toHaveBeenCalledWith(1);
  });

  it('renders Acesso Aberto badge when is_oa is 1', () => {
    const articlesWithOa = [
      {
        ...mockArticles[0],
        is_oa: 1,
      },
    ];
    renderComponent({ paginatedArticles: articlesWithOa, activeArticlesLength: 1 });
    expect(screen.getByText('🔓 Acesso Aberto')).toBeDefined();
  });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ArticleSelector } from '../ArticleSelector';
import { type Article, type SearchHistoryItem } from '../../../types';

const mockArticles: Article[] = [
  {
    id: 1,
    project_id: 10,
    title: 'Alpha Deep Learning for Medicine',
    authors: 'Alice Smith',
    year: 2022,
    journal: 'Nature Medicine',
    search_id: 101,
    local_file_path: '/path/to/alpha.pdf',
    status: 'new',
  },
  {
    id: 2,
    project_id: 10,
    title: 'Beta Machine Learning in Clinical Trials',
    authors: 'Bob Jones',
    year: 2024,
    journal: 'Lancet',
    search_id: 102,
    local_file_path: '/path/to/beta.pdf',
    status: 'new',
  },
  {
    id: 3,
    project_id: 10,
    title: 'Gamma Neural Networks in Healthcare',
    authors: 'Charlie Brown',
    year: 2020,
    journal: 'IEEE',
    search_id: 101,
    local_file_path: '/path/to/gamma.pdf',
    status: 'new',
  },
];

const mockSearchHistory: SearchHistoryItem[] = [
  {
    id: 101,
    unified_query: 'deep learning medicine',
    translated_queries: '{}',
    total_results: 10,
    results_breakdown: '{}',
    created_at: '2026-01-01',
  },
  {
    id: 102,
    unified_query: 'machine learning clinical',
    translated_queries: '{}',
    total_results: 5,
    results_breakdown: '{}',
    created_at: '2026-01-02',
  },
];

describe('ArticleSelector', () => {
  it('renders all articles and search history badge labels by default', () => {
    const setSelectedIds = vi.fn();
    render(
      <ArticleSelector
        articles={mockArticles}
        selectedIds={[1]}
        setSelectedIds={setSelectedIds}
        searchHistory={mockSearchHistory}
      />
    );

    expect(screen.getByText('Alpha Deep Learning for Medicine')).toBeInTheDocument();
    expect(screen.getByText('Beta Machine Learning in Clinical Trials')).toBeInTheDocument();
    expect(screen.getByText('Gamma Neural Networks in Healthcare')).toBeInTheDocument();
    expect(screen.getAllByText(/#101: deep learning medicine/).length).toBeGreaterThan(0);
  });

  it('filters articles by search term', () => {
    const setSelectedIds = vi.fn();
    render(
      <ArticleSelector
        articles={mockArticles}
        selectedIds={[]}
        setSelectedIds={setSelectedIds}
        searchHistory={mockSearchHistory}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Buscar por título, autor, ano.../i);
    fireEvent.change(searchInput, { target: { value: 'Beta' } });

    expect(screen.queryByText('Alpha Deep Learning for Medicine')).not.toBeInTheDocument();
    expect(screen.getByText('Beta Machine Learning in Clinical Trials')).toBeInTheDocument();
    expect(screen.queryByText('Gamma Neural Networks in Healthcare')).not.toBeInTheDocument();
  });

  it('filters articles by search history item', () => {
    const setSelectedIds = vi.fn();
    render(
      <ArticleSelector
        articles={mockArticles}
        selectedIds={[]}
        setSelectedIds={setSelectedIds}
        searchHistory={mockSearchHistory}
      />
    );

    const selectDropdown = screen.getByDisplayValue(/Todas as buscas/i);
    fireEvent.change(selectDropdown, { target: { value: '102' } });

    expect(screen.queryByText('Alpha Deep Learning for Medicine')).not.toBeInTheDocument();
    expect(screen.getByText('Beta Machine Learning in Clinical Trials')).toBeInTheDocument();
    expect(screen.queryByText('Gamma Neural Networks in Healthcare')).not.toBeInTheDocument();
  });

  it('sorts articles by year descending', () => {
    const setSelectedIds = vi.fn();
    render(
      <ArticleSelector
        articles={mockArticles}
        selectedIds={[]}
        setSelectedIds={setSelectedIds}
        searchHistory={mockSearchHistory}
      />
    );

    const sortDropdown = screen.getByDisplayValue(/Título \(A-Z\)/i);
    fireEvent.change(sortDropdown, { target: { value: 'year-desc' } });

    const titles = screen.getAllByText(/Deep Learning|Machine Learning|Neural Networks/).map((el) => el.textContent);
    expect(titles[0]).toContain('Beta Machine Learning');
    expect(titles[1]).toContain('Alpha Deep Learning');
    expect(titles[2]).toContain('Gamma Neural Networks');
  });

  it('handles select all and deselect all actions', () => {
    const setSelectedIds = vi.fn();
    render(
      <ArticleSelector
        articles={mockArticles}
        selectedIds={[1]}
        setSelectedIds={setSelectedIds}
        searchHistory={mockSearchHistory}
      />
    );

    const selectAllBtn = screen.getByRole('button', { name: /Selecionar Todos/i });
    fireEvent.click(selectAllBtn);
    expect(setSelectedIds).toHaveBeenCalledWith([1, 2, 3]);

    const deselectAllBtn = screen.getByRole('button', { name: /Desmarcar Todos/i });
    fireEvent.click(deselectAllBtn);
    expect(setSelectedIds).toHaveBeenCalledWith([]);
  });

  it('toggles individual article selection', () => {
    const setSelectedIds = vi.fn();
    render(
      <ArticleSelector
        articles={mockArticles}
        selectedIds={[1]}
        setSelectedIds={setSelectedIds}
        searchHistory={mockSearchHistory}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    // Article 2 checkbox is index 1
    fireEvent.click(checkboxes[1]);
    expect(setSelectedIds).toHaveBeenCalledWith([1, 2]);
  });
});

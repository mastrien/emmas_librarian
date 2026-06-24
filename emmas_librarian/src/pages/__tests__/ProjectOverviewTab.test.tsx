import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProjectOverviewTab } from '../ProjectDetails/components/ProjectOverviewTab';
import { Article } from '../../types';

describe('ProjectOverviewTab', () => {
  const mockArticles: Article[] = [
    {
      id: 1,
      project_id: 1,
      title: 'Article 1',
      status: 'new',
      is_oa: 1,
      publisher: 'Elsevier',
      source_databases: '["Scopus"]'
    },
    {
      id: 2,
      project_id: 1,
      title: 'Article 2',
      status: 'read',
      is_oa: 0,
      publisher: 'Springer',
      source_databases: '["Web of Science"]'
    },
    {
      id: 3,
      project_id: 1,
      title: 'Article 3',
      status: 'archived',
      is_oa: 1,
      publisher: 'Elsevier',
      source_databases: '["Scopus"]'
    }
  ];

  const activeArticles = mockArticles.filter(a => a.status === 'new');
  const readArticles = mockArticles.filter(a => a.status === 'read');
  const archivedArticles = mockArticles.filter(a => a.status === 'archived');

  it('renders all 4 charts properly', () => {
    render(
      <ProjectOverviewTab 
        activeArticles={activeArticles}
        readArticles={readArticles}
        archivedArticles={archivedArticles}
        filteredArticles={mockArticles}
      />
    );

    expect(screen.getByText('Status dos Artigos')).toBeInTheDocument();
    expect(screen.getByText('Artigos por Ano')).toBeInTheDocument();
    expect(screen.getByText('Acesso Aberto (Open Access)')).toBeInTheDocument();
    expect(screen.getByText('Artigos por Base de Dados')).toBeInTheDocument();
    expect(screen.getByText('Top 10 Editoras / Publishers')).toBeInTheDocument();
    expect(screen.getByText('Completude de DOI')).toBeInTheDocument();
  });
});

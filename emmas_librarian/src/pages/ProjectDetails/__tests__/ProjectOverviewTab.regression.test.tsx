import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProjectOverviewTab } from '../components/ProjectOverviewTab';

describe('ProjectOverviewTab - Regression Tests', () => {
  it('renders charts without throwing "scale is not registered" errors', () => {
    // We intentionally do NOT mock react-chartjs-2 here.
    // If the components (like LinearScale, CategoryScale) are not properly
    // registered using ChartJS.register(), rendering these charts will
    // throw an error synchronously.
    
    const dummyArticle: any = {
      id: 1, 
      year: 2021, 
      is_oa: 1, 
      source_databases: '["Scopus"]', 
      publisher: 'Elsevier', 
      doi: '10.123/1',
      project_id: 1,
      title: 'Test Article',
      status: 'new'
    };

    expect(() => {
      render(
        <ProjectOverviewTab 
          activeArticles={[dummyArticle]} 
          readArticles={[]} 
          archivedArticles={[]} 
          filteredArticles={[dummyArticle]} 
        />
      );
    }).not.toThrow();
  });
});

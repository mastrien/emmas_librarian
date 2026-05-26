import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProjectDetailsPage } from '../ProjectDetailsPage';

vi.mock('../../services/api', () => ({
  projectService: {
    getProject: vi.fn().mockResolvedValue({ id: 1, name: 'Project 1' }),
    getSearchHistory: vi.fn().mockResolvedValue([]),
    getDiaryEntries: vi.fn().mockResolvedValue([]),
    getProjectDocuments: vi.fn().mockResolvedValue([]),
    getMassiveInvestigations: vi.fn().mockResolvedValue([]),
    getArticles: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('../../components/ArticleModal', () => ({
  ArticleModal: () => <div data-testid="article-modal" />
}));
vi.mock('../../components/SearchHistoryModal', () => ({
  SearchHistoryModal: () => <div data-testid="search-history-modal" />
}));

describe('ProjectDetailsPage', () => {
  it('renders correctly', async () => {
    const { container } = render(
      <BrowserRouter>
        <ProjectDetailsPage />
      </BrowserRouter>
    );
    expect(container).toBeInTheDocument();
  });
});

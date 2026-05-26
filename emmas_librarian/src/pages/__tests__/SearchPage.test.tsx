import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SearchPage } from '../SearchPage';

vi.mock('../../services/api', () => ({
  projectService: {
    getProject: vi.fn().mockResolvedValue({ id: 1, name: 'Project 1' }),
    translateQuery: vi.fn().mockResolvedValue({}),
    searchAndPersist: vi.fn().mockResolvedValue({ results: [], breakdown: {} }),
  }
}));

describe('SearchPage', () => {
  it('renders correctly', async () => {
    const { container } = render(
      <BrowserRouter>
        <SearchPage />
      </BrowserRouter>
    );
    expect(container).toBeInTheDocument();
  });
});

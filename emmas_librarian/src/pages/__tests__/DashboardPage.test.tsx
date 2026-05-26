import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardPage } from '../DashboardPage';

vi.mock('../../services/api', () => ({
  projectService: {
    getProjects: vi.fn().mockResolvedValue([]),
    getDiaryEntries: vi.fn().mockResolvedValue([]),
  }
}));

describe('DashboardPage', () => {
  it('renders correctly', async () => {
    const { container } = render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );
    expect(container).toBeInTheDocument();
  });
});

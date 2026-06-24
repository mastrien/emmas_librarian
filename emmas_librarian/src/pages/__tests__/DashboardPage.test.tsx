import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardPage } from '../DashboardPage';

import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {}
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
  });

  it('renders correctly', async () => {
    const { container } = render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>,
    );
    expect(container).toBeInTheDocument();
  });
});

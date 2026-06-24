import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsPage } from '../SettingsPage';

import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {}
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
  });

  it('renders correctly', async () => {
    const { container } = render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>,
    );
    expect(container).toBeInTheDocument();
  });
});
